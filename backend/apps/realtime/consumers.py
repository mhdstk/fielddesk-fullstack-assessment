import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model
from django.conf import settings
import jwt

from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger("apps.realtime")
User = get_user_model()

@database_sync_to_async
def get_user_from_token(token_str):
    try:
        validated_token = AccessToken(token_str)
        user_id = validated_token.get("user_id")
        if not user_id:
            return None
        return User.objects.select_related("organisation").get(id=user_id)
    except Exception as e:
        logger.warning(f"WS auth failed: {e}")
        return None

class WorkOrderConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # token via query param ?token=xxx
        query_string = self.scope.get("query_string", b"").decode()
        token = None
        for part in query_string.split("&"):
            if part.startswith("token="):
                token = part.split("=", 1)[1]
                break
        # also check header Authorization
        if not token:
            headers = dict(self.scope.get("headers", []))
            auth = headers.get(b"authorization", b"").decode()
            if auth.startswith("Bearer "):
                token = auth[7:]

        if not token:
            await self.close(code=4401)
            return

        user = await get_user_from_token(token)
        if not user or not user.is_active:
            await self.close(code=4401)
            return

        self.user = user
        self.org_group = f"org_{user.organisation_id}"
        await self.channel_layer.group_add(self.org_group, self.channel_name)
        await self.accept()
        logger.info(f"WS connected user={user.username} org={user.organisation.slug}")
        await self.send(text_data=json.dumps({"type": "connected", "org": str(user.organisation_id), "user": user.username}))

    async def disconnect(self, close_code):
        if hasattr(self, "org_group"):
            await self.channel_layer.group_discard(self.org_group, self.channel_name)

    async def work_order_update(self, event):
        # enforce org isolation already via group; send to client
        await self.send(text_data=json.dumps({"type": "work_order_update", "data": event.get("data")}))

    async def receive(self, text_data=None, bytes_data=None):
        # keepalive ping
        if text_data:
            try:
                data = json.loads(text_data)
                if data.get("type") == "ping":
                    await self.send(text_data=json.dumps({"type": "pong"}))
            except Exception:
                pass
