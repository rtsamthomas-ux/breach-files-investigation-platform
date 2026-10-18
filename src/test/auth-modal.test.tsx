import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthModal } from "../components/AuthModal";
import * as supabaseClientModule from "../lib/supabase-client";

describe("AuthModal — Participant Self-Registration, Login & Password Reset", () => {
  const mockSignUp = vi.fn();
  const mockSignInWithPassword = vi.fn();
  const mockResetPasswordForEmail = vi.fn();
  const mockUpdateUser = vi.fn();
  const mockSignOut = vi.fn();

  const mockSupabase = {
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignInWithPassword,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays offline warning when Supabase is not configured", () => {
    vi.spyOn(supabaseClientModule, "isSupabaseConfigured", "get").mockReturnValue(false);
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(null);

    render(<AuthModal user={null} onAuthChange={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(/DATABASE CREDENTIALS PENDING/i)).toBeInTheDocument();
    expect(screen.getByText(/Offline Investigator Mode/i)).toBeInTheDocument();
  });

  it("supports participant self-registration with callsign, email, and password", async () => {
    vi.spyOn(supabaseClientModule, "isSupabaseConfigured", "get").mockReturnValue(true);
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(
      mockSupabase as unknown as SupabaseClient,
    );

    mockSignUp.mockResolvedValueOnce({
      data: { session: { access_token: "test-token" } },
      error: null,
    });

    const onAuthChange = vi.fn();
    const onClose = vi.fn();

    render(<AuthModal user={null} onAuthChange={onAuthChange} onClose={onClose} />);

    // Switch to Register mode
    fireEvent.click(screen.getByText(/Need a participant profile\? Register here/i));
    expect(screen.getByText("REGISTER PARTICIPANT")).toBeInTheDocument();

    // Fill in participant registration fields
    fireEvent.change(screen.getByPlaceholderText("e.g. agent_keller"), {
      target: { value: "agent_palmer" },
    });
    fireEvent.change(screen.getByPlaceholderText("analyst@agency.internal"), {
      target: { value: "palmer@agency.internal" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "SecurePass123!" },
    });

    // Submit registration
    fireEvent.click(screen.getByRole("button", { name: /CREATE ACCOUNT/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "palmer@agency.internal",
        password: "SecurePass123!",
        options: {
          data: {
            username: "agent_palmer",
          },
        },
      });
      expect(screen.getByText(/Account created and signed in successfully/i)).toBeInTheDocument();
      expect(onAuthChange).toHaveBeenCalledTimes(1);
    });
  });

  it("supports investigator login with email and password", async () => {
    vi.spyOn(supabaseClientModule, "isSupabaseConfigured", "get").mockReturnValue(true);
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(
      mockSupabase as unknown as SupabaseClient,
    );

    mockSignInWithPassword.mockResolvedValueOnce({
      data: { session: { access_token: "test-token" } },
      error: null,
    });

    const onAuthChange = vi.fn();
    const onClose = vi.fn();

    render(<AuthModal user={null} onAuthChange={onAuthChange} onClose={onClose} />);

    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("analyst@agency.internal"), {
      target: { value: "palmer@agency.internal" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••••••"), {
      target: { value: "SecurePass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "SIGN IN" }));

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: "palmer@agency.internal",
        password: "SecurePass123!",
      });
      expect(screen.getByText(/Signed in successfully/i)).toBeInTheDocument();
      expect(onAuthChange).toHaveBeenCalledTimes(1);
    });
  });

  it("supports password reset flow via resetPasswordForEmail", async () => {
    vi.spyOn(supabaseClientModule, "isSupabaseConfigured", "get").mockReturnValue(true);
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(
      mockSupabase as unknown as SupabaseClient,
    );

    mockResetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: null,
    });

    render(<AuthModal user={null} onAuthChange={vi.fn()} onClose={vi.fn()} />);

    // Click Forgot password link
    fireEvent.click(screen.getByText(/Forgot password\?/i));

    expect(screen.getByText("RESET PASSWORD")).toBeInTheDocument();
    expect(screen.getByText(/Enter your registered investigator email/i)).toBeInTheDocument();

    // Fill in email
    fireEvent.change(screen.getByPlaceholderText("analyst@agency.internal"), {
      target: { value: "investigator@novacorp.internal" },
    });

    // Click Send Reset Link
    fireEvent.click(screen.getByRole("button", { name: /SEND RESET LINK/i }));

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "investigator@novacorp.internal",
        expect.objectContaining({
          redirectTo: expect.any(String),
        }),
      );
      expect(
        screen.getByText(/Password reset email sent. Please check your inbox for instructions./i),
      ).toBeInTheDocument();
    });

    // Can return to Sign In
    fireEvent.click(screen.getByText(/Remembered your password\? Back to Sign In/i));
    expect(screen.getByRole("button", { name: "SIGN IN" })).toBeInTheDocument();
  });

  it("allows authenticated user to update their password and sign out", async () => {
    vi.spyOn(supabaseClientModule, "isSupabaseConfigured", "get").mockReturnValue(true);
    vi.spyOn(supabaseClientModule, "getSupabaseClient").mockReturnValue(
      mockSupabase as unknown as SupabaseClient,
    );

    mockUpdateUser.mockResolvedValueOnce({
      data: { user: {} },
      error: null,
    });
    mockSignOut.mockResolvedValueOnce({ error: null });

    const onAuthChange = vi.fn();
    const onClose = vi.fn();

    render(
      <AuthModal
        user={{
          id: "00000000-0000-0000-0000-000000000001",
          username: "agent_keller",
          email: "keller@nova.internal",
          role: "participant",
        }}
        onAuthChange={onAuthChange}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("INVESTIGATOR CREDENTIALS")).toBeInTheDocument();
    expect(screen.getByText("agent_keller")).toBeInTheDocument();

    // Toggle Change Password
    fireEvent.click(screen.getByRole("button", { name: /CHANGE PASSWORD/i }));

    const newPassInput = screen.getByPlaceholderText(/Enter new password/i);
    fireEvent.change(newPassInput, { target: { value: "NewSecurePassword456!" } });

    fireEvent.click(screen.getByRole("button", { name: /SAVE PASSWORD/i }));

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "NewSecurePassword456!",
      });
      expect(screen.getByText(/Password updated successfully/i)).toBeInTheDocument();
    });

    // Test sign out
    fireEvent.click(screen.getByRole("button", { name: /SIGN OUT/i }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
      expect(onAuthChange).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
