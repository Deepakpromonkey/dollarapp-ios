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

interface AppRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
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
    const originalRequest = error.config as AppRequestConfig &
      InternalAxiosRequestConfig;

    if (error.response?.status === 401 && !originalRequest.skipAuth) {
      await clearSession();
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
      console.log("FormData Parts:", JSON.stringify((formData as any)._parts));
      console.log("============================");

      const response = await axiosInstance.post<T>(path, formData, {
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
}
export interface OtpLoginPayload {
  contact: string;
  otp: string;
}
export interface Driver {
  id: number;
  row_id: string;
  sub_users_of: string | null;
  prefix: string;
  name: string;
  first_name: string;
  last_name: string;
  suffix: string;
  email: string;
  profile_pic: string;
  c_code: string | null;
  contact: string;
  last_login: string | null;
  active_plan: string;
  lifetime_loads: number;
  consumed_loads: number;
  subscription_id: string;
  stripe_customer_id: string;
  address: string;
  city: string;
  state: string;
  state_id: string;
  pincode: string;
  country: string;
  lead_id: string;
  forgot_password_datetime: string | null;
  users_of: string;
  roles: string;
  add_type: string;
  send_invite: number;
  added_on: string;
  updated_on: string | null;
  status: number;
  phone_verified: boolean;
  carrier_name: string;
  cdl_front_path: string;
  cdl_back_path: string;
  liveness_verified: boolean;
}
export interface LoginResponse {
  status: string;
  message: string;
  token: string;
  driver: Driver;
}
export interface AuthTokens {
  token: string;
  refreshToken?: string;
  driver: Driver;
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
export interface DriverProfile {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  designation: string | null;
  profile_image: string | null;
  is_owner: number;
  status: number;
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  company_id: number | null;
  two_factor_enabled: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_password_changed_at: string | null;
  roles: Array<{
    id: number;
    name: string;
    guard_name: string;
    created_at: string;
    updated_at: string;
  }>;
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
  shipment: { id: number; uuid: string; shipment_no: string };
}
export interface CompleteProfileResponse {
  status: string;
  message: string;
  data: {
    driver_profile: DriverProfile;
    verified_equipment_history: VerifiedEquipment[];
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
    api.post<{
      status: string;
      didit_session_id: string;
      session_token: string;
      session_url: string;
    }>(
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
