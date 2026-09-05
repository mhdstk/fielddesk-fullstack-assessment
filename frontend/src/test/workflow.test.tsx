import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import { Topbar } from "@/components/Topbar";
import { setTokens, clearTokens, getToken, apiJson } from "@/lib/api";
import { User } from "@/lib/types";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  useParams: () => ({
    id: "test-wo-123",
  }),
}));

// Mock useAuth
const mockLogin = vi.fn();
const mockLogout = vi.fn();
let mockUser: User | null = null;

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: mockUser,
    login: mockLogin,
    logout: mockLogout,
    loading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("Frontend Workflows and Security Boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockUser = null;
  });

  describe("Token Storage and API Utility", () => {
    it("stores and clears authentication tokens safely in localStorage", () => {
      expect(getToken()).toBeNull();
      setTokens("access-123", "refresh-456");
      expect(getToken()).toBe("access-123");
      expect(localStorage.getItem("refresh_token")).toBe("refresh-456");
      clearTokens();
      expect(getToken()).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
    });

    it("parses structured API errors correctly", async () => {
      const mockResponse = {
        ok: false,
        status: 409,
        text: async () =>
          JSON.stringify({
            error: {
              code: "conflict",
              message: "Worker already assigned",
            },
          }),
        headers: new Headers(),
      } as unknown as Response;

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      await expect(apiJson("/api/work-orders/1/assign/")).rejects.toThrow(
        "Worker already assigned"
      );
    });
  });

  describe("Login Workflow", () => {
    it("renders sign in screen with sample accounts", () => {
      render(<LoginPage />);
      expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.getByPlaceholderText("acme_owner")).toBeInTheDocument();
      expect(screen.getByText("Sample accounts")).toBeInTheDocument();
      expect(screen.getByText("Acme — Owner")).toBeInTheDocument();
      expect(screen.getByText("Globex — Dispatcher")).toBeInTheDocument();
    });

    it("clicking a sample account populates the credentials form", () => {
      render(<LoginPage />);
      const techBtn = screen.getByText("Acme — Technician");
      fireEvent.click(techBtn);
      const input = screen.getByPlaceholderText("acme_owner") as HTMLInputElement;
      expect(input.value).toBe("acme_technician");
    });

    it("submits login and redirects to dashboard upon success", async () => {
      mockLogin.mockResolvedValueOnce(undefined);
      render(<LoginPage />);

      const submitBtn = screen.getByRole("button", { name: "Sign in" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("acme_owner", "Password123!");
        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("displays error banner when login fails", async () => {
      mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"));
      render(<LoginPage />);

      const submitBtn = screen.getByRole("button", { name: "Sign in" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation and Organisation Scope Header", () => {
    it("renders organisation name and user role in Topbar", () => {
      mockUser = {
        id: "user-1",
        username: "acme_dispatcher",
        email: "disp@acme.com",
        role: "dispatcher",
        organisation: {
          id: "org-1",
          name: "Acme Field Co",
          slug: "acme",
        },
      };

      render(<Topbar title="Work Orders" subtitle="Acme Field Co • Live data" />);
      expect(screen.getByText("Work Orders")).toBeInTheDocument();
      expect(screen.getByText("Acme Field Co • Live data")).toBeInTheDocument();
      expect(screen.getByText("acme_dispatcher")).toBeInTheDocument();
      expect(screen.getByText("dispatcher")).toBeInTheDocument();
    });
  });
});
