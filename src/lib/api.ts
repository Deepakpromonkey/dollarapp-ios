import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

import { clearSession, getAccessToken } from "./secureStore";


export const BASE_URL = "https://driverapi.dollartraq.com/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  ok: boolean;
}

export interface StopEventData {
  stop_id: number;
  stop_type: string;
  requires_otp: boolean;
  events: any[]; // Or whatever your events type is
  outstanding: number;
}

export interface JourneyStatusResponse {
  status: boolean;
  message: string;
  data: {
    current_step: string;
    journey: any;
    is_equipment_verified: boolean;
    stop_events: {
      pickup: StopEventData | null;
      delivery: StopEventData | null;
      all_stops: StopEventData[];
    };
  };
}

interface AppRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
}

/*
| What to do when the server stops accepting this phone's session.
|
| A token is revoked when the driver logs in on another phone or asks for the
| account to be deleted, and every request still carrying it then gets a 401.
| Clearing the stored token here was all that happened before, so the signed-in
| screens stayed up with every request failing until the app was restarted.
| AuthContext registers a handler that signs the driver out properly.
*/
type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const axiosInstance: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const appConfig = config as InternalAxiosRequestConfig & AppRequestConfig;

    if (!appConfig.skipAuth) {
      const token = await getAccessToken();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
);

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (AppRequestConfig & InternalAxiosRequestConfig)
      | undefined;

    if (error.response?.status === 401 && !originalRequest?.skipAuth) {
      /*
      | Only the session that sent the request is over. A reply that lands after
      | the driver has already signed out and back in carries the old token, and
      | must not wipe the new one.
      */
      const headers = originalRequest?.headers;
      const sentAuth =
        typeof headers?.get === "function"
          ? headers.get("Authorization")
          : headers?.["Authorization"];
      const sentToken = String(sentAuth ?? "").replace(/^Bearer\s+/i, "");
      const currentToken = (await getAccessToken().catch(() => null)) ?? "";

      if (sentToken === currentToken) {
        await clearSession().catch(() => {});
        try {
          unauthorizedHandler?.();
        } catch (err) {
          console.warn("[api] Unauthorized handler failed:", err);
        }
      }

      return Promise.reject(
        new ApiError(401, "Session expired — please log in again"),
      );
    }

    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    const message =
      status === 413
        ? "Images are too large. Please try again."
        : ((body as Record<string, string>)?.message ??
          error.message ??
          `Request failed with status ${status}`);

    return Promise.reject(new ApiError(status, message, body));
  },
);

async function wrap<T>(
  promise: Promise<AxiosResponse<T>>,
): Promise<ApiResponse<T>> {
  const res = await promise;
  return { data: res.data, status: res.status, ok: true };
}

export const api = {
  get<T = unknown>(path: string, config?: AppRequestConfig) {
    return wrap<T>(axiosInstance.get<T>(path, config));
  },

  post<T = unknown>(path: string, body?: unknown, config?: AppRequestConfig) {
    return wrap<T>(axiosInstance.post<T>(path, body, config));
  },

  put<T = unknown>(path: string, body?: unknown, config?: AppRequestConfig) {
    return wrap<T>(axiosInstance.put<T>(path, body, config));
  },

  patch<T = unknown>(path: string, body?: unknown, config?: AppRequestConfig) {
    return wrap<T>(axiosInstance.patch<T>(path, body, config));
  },

  delete<T = unknown>(path: string, config?: AppRequestConfig) {
    return wrap<T>(axiosInstance.delete<T>(path, config));
  },

  async upload<T = unknown>(
    path: string,
    formData: FormData,
    config?: AppRequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${BASE_URL}${path}`;

      console.log("=== API.UPLOAD TRIGGERED ===");
      console.log("Target URL:", url);
      console.log("============================");

      const response = await axiosInstance.post<T>(path, formData, {
        /*
        | Photos over a weak signal need longer than the 15 s that suits
        | ordinary requests. Cut off at 15 s, a delivery photo the server had
        | in fact received came back as "Network Error".
        */
        timeout: 120_000,
        ...config,
        headers: {
          ...(config?.headers ?? {}),
          "Content-Type": "multipart/form-data",
        },
        transformRequest: [(data) => data],
      });

      console.log("=== UPLOAD SUCCESS ===", response.status);
      return { data: response.data, status: response.status, ok: true };
    } catch (error: any) {
      console.log("=== RAW AXIOS NETWORK ERROR ===");
      console.log("Error Name:", error.name);
      console.log("Error Message:", error.message);
      console.log("Axios Code:", error.code); // This is usually the real culprit (e.g., ERR_NETWORK)
      console.log("Has Response?", !!error.response);
      if (error.response) {
        console.log("Response Status:", error.response.status);
        console.log("Response Data:", error.response.data);
      } else {
        console.log("Raw Error Object:", error);
      }
      console.log("===============================");

      throw error; // Let the interceptor handle it after we log it
    }
  },

  instance: axiosInstance,
} as const;

// ... [All your exact same interfaces for Driver, Auth, Login, Profile below] ...
export interface LoginPayload {
  email: string;
  password: string;
  device_token?: string | null;
}
export interface OtpLoginPayload {
  contact: string;
  otp: string;
  device_token?: string | null;
}

/*
 * app_drivers.liveness_status as the API stores it. The broker's control tower
 * reads the same column, so these are the only values there are: "pending" is
 * the column default on older rows and "skipped" a driver who chose to verify
 * later. Use utils/liveness resolveLiveness to turn it into what the app shows.
 */
export type LivenessStatus =
  | "approved"
  | "in_review"
  | "declined"
  | "pending"
  | "skipped";
/*
 * Mirrors DriverResource on the API. This used to describe the broker API's
 * `drivers` table — row_id, active_plan, lifetime_loads, roles and a dozen more
 * columns that `app_drivers` has never had — so most of it was always undefined
 * at runtime and the fields that mattered were quietly lost on the way into
 * SecureStore.
 */
export interface Driver {
  id: number;
  uuid: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  contact: string | null;
  profile_pic: string | null;
  carrier_name: string | null;
  company_id: number | null;
  status: string;
  phone_verified: boolean;
  email_verified_at: string | null;
  liveness_verified: boolean;
  liveness_status: LivenessStatus;
  cdl_number: string | null;
  cdl_state: string | null;
  cdl_expiration: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
}
export interface LoginResponse {
  status: string;
  message: string;
  token: string;
  driver: Driver;
  /*
   * True when this login cancelled a pending account deletion. Logging in is
   * how a driver keeps an account they asked to delete, so the app tells them.
   */
  deletion_cancelled?: boolean;
}
export interface AuthTokens {
  token: string;
  refreshToken?: string;
  driver: Driver;

  /*
   * Registration returns this. "in_review" means the account exists but Didit
   * has not decided the identity check yet — the verdict reaches the backend by
   * webhook, not by anything the app can wait on here.
   */
  liveness_status?: Exclude<LivenessStatus, "pending">;
  message?: string;
}
export interface SignupPayload {
  phone: string;
  dialCode: string;
  fullName: string;
  carrier: string;
  email: string;
  cdlFront?: string;
  cdlBack?: string;
}
export interface SendOtpResponse {
  status: string;
  message: string;
  dev_note?: string;
}
export interface VerifyOtpResponse {
  status: string;
  message: string;
  registration_token: string;
}
/*
 * Mirrors what GET /driver/profile actually builds. The previous shape was the
 * broker API's user record — designation, is_owner, two_factor_enabled, roles —
 * so `profile.profile_image` and `profile.roles` were undefined at runtime and
 * the avatar on the personal-info screen could never render.
 */
export interface DriverProfile {
  id: number;
  uuid: string | null;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  email: string;
  phone: string | null;
  status: string;
  cdl_number: string | null;
  cdl_state: string | null;
  cdl_expiration: string | null;
  cdl_front_image: string | null;
  cdl_back_image: string | null;
  dob: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
  updated_at: string;
  /*
   * Added to GET /driver/profile later, so an older API build leaves them out.
   * GET /driver/complete-profile has carried the liveness pair all along.
   */
  liveness_verified?: boolean;
  liveness_status?: LivenessStatus | null;
  carrier_name?: string | null;
}
export interface DriverProfileResponse {
  status: boolean;
  message: string;
  data: DriverProfile;
}
export interface VerifiedEquipment {
  id: number;
  driver_id: number;
  shipment_id: number;
  vin_image_url: string;
  vin_text: string | null;
  tractor_image_url: string;
  tractor_text: string | null;
  trailer_image_url: string;
  trailer_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  shipment: {
    id: number;
    uuid: string;
    shipment_no: string;
    /* Sent by newer API builds so the screen can match the photos to the load's units. */
    pro_number?: string | null;
    truck_number?: string | null;
    trailer_number?: string | null;
  } | null;
}
export interface CompleteProfileResponse {
  status: string;
  message: string;
  data: {
    driver_profile: DriverProfile & {
      /* Storage paths, from API builds that predate the ready-made image URLs. */
      cdl_front_path?: string | null;
      cdl_back_path?: string | null;
    };
    verified_equipment_history: VerifiedEquipment[];
  };
}

/** POST /driver/liveness/session, same shape as the signup one. */
export interface LivenessSessionResponse {
  status: string;
  message?: string;
  didit_session_id: string;
  session_token: string | null;
  session_url: string | null;
}

/** POST /driver/liveness/refresh: the verdict Didit holds for the driver's session now. */
export interface LivenessRefreshResponse {
  status: string;
  message?: string;
  liveness_status: LivenessStatus;
  liveness_verified: boolean;
  driver?: Driver;
  /*
   * Didit's own status for that session ("In Progress", "Abandoned", ...),
   * when the API sends it. liveness_status alone cannot tell a check Didit is
   * still working on from one it gave up on: both leave it skipped or pending.
   */
  didit_status?: string | null;
}

export interface AccountDeletionResponse {
  status: boolean;
  message: string;
  data: {
    /** ISO 8601. The account is purged after this unless the driver logs in. */
    deletion_scheduled_for: string;
    grace_days: number;
    /*
     * The "log in before" date as the email states it ("28 Oct 2026"), worked
     * out so it is never later than the purge in any driver's own time zone.
     * Older API builds leave it out.
     */
    deletion_date?: string;
  };
}

export const driverApi = {
  getProfile: () => api.get<DriverProfileResponse>("/driver/profile"),
  getCompleteProfile: () =>
    api.get<CompleteProfileResponse>("/driver/complete-profile"),
  uploadProfilePic: (formData: FormData) =>
    api.upload<{ status: string; message: string }>(
      "/driver/profile-picture",
      formData,
    ),
  /*
   * Identity check after signup, for drivers who skipped it or were declined.
   * Answers 409 with a message when the driver is already verified or under
   * review.
   */
  startLiveness: () =>
    api.post<LivenessSessionResponse>("/driver/liveness/session"),
  refreshLiveness: () =>
    api.post<LivenessRefreshResponse>("/driver/liveness/refresh"),
  /*
   * Schedules the account for deletion and signs the driver out on every
   * phone: the token sent with this request stops working as soon as it
   * succeeds.
   */
  requestAccountDeletion: (reason?: string) =>
    api.post<AccountDeletionResponse>("/driver/account/delete", {
      confirm: true,
      ...(reason?.trim() ? { reason: reason.trim().slice(0, 500) } : {}),
    }),
} as const;

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>("/login", payload, { skipAuth: true }),
  sendLoginOtp: (contact: string) =>
    api.post<SendOtpResponse>(
      "/auth/send-otp",
      { contact },
      { skipAuth: true },
    ),
  loginOtp: (payload: OtpLoginPayload) =>
    api.post<LoginResponse>("/auth/login-with-otp", payload, {
      skipAuth: true,
    }),
  sendSignupPhoneOtp: (contact: string) =>
    api.post<SendOtpResponse>(
      "/register/send-otp",
      { contact },
      { skipAuth: true },
    ),
  verifySignupPhoneOtp: (contact: string, otp: string) =>
    api.post<VerifyOtpResponse>(
      "/register/verify-otp",
      { contact, otp },
      { skipAuth: true },
    ),
  sendSignupEmailOtp: (registration_token: string, email: string) =>
    api.post<SendOtpResponse>(
      "/register/send-email-otp",
      { registration_token, email },
      { skipAuth: true },
    ),
  verifySignupEmailOtp: (
    registration_token: string,
    email: string,
    otp: string,
  ) =>
    api.post<{ status: string; message: string }>(
      "/register/verify-email-otp",
      { registration_token, email, otp },
      { skipAuth: true },
    ),
  livenessSession: (registration_token: string) =>
    api.post<LivenessSessionResponse>(
      "/register/liveness-session",
      { registration_token },
      { skipAuth: true },
    ),
  completeRegistration: (formData: FormData) =>
    api.upload<AuthTokens>("/register/complete", formData, { skipAuth: true }),
  sendPhoneOtp: (phone: string, dialCode: string) =>
    api.post("/auth/otp/phone/send", { phone, dialCode }, { skipAuth: true }),
  verifyPhoneOtp: (phone: string, dialCode: string, otp: string) =>
    api.post(
      "/auth/otp/phone/verify",
      { phone, dialCode, otp },
      { skipAuth: true },
    ),
  sendEmailOtp: (email: string) =>
    api.post("/auth/otp/email/send", { email }, { skipAuth: true }),
  verifyEmailOtp: (email: string, otp: string) =>
    api.post("/auth/otp/email/verify", { email, otp }, { skipAuth: true }),
  logout: () => api.post("/auth/logout"),
  forgotPassword: (email: string) =>
    api.post("/auth/forgot-password", { email }, { skipAuth: true }),
  forgotPasswordSendOtp: (contact: string) =>
    api.post<SendOtpResponse>(
      "/auth/send-otp",
      { contact },
      { skipAuth: true },
    ),
  forgotPasswordVerifyOtp: (contact: string, otp: string) =>
    api.post<{ status: string; message: string; reset_token: string }>(
      "/auth/verify-reset-otp",
      { contact, otp },
      { skipAuth: true },
    ),
  forgotPasswordReset: (reset_token: string, password: string) =>
    api.post<{ status: string; message: string }>(
      "/auth/reset-password",
      { reset_token, password },
      { skipAuth: true },
    ),
} as const;
