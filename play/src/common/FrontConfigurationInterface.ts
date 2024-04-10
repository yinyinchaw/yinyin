import type { OpidWokaNamePolicy } from "@workadventure/messages";

export interface FrontConfigurationInterface {
    DEBUG_MODE: boolean;
    PUSHER_URL: string;
    FRONT_URL: string;
    ADMIN_URL: string | undefined;
    UPLOADER_URL: string;
    ICON_URL: string;
    STUN_SERVER: string | undefined;
    TURN_SERVER: string | undefined;
    SKIP_RENDER_OPTIMIZATIONS: boolean;
    DISABLE_NOTIFICATIONS: boolean;
    TURN_USER: string | undefined;
    TURN_PASSWORD: string | undefined;
    JITSI_URL: string | undefined;
    JITSI_PRIVATE_MODE: boolean;
    ENABLE_MAP_EDITOR: boolean;
    PUBLIC_MAP_STORAGE_PREFIX: string | undefined;
    MAX_USERNAME_LENGTH: number;
    MAX_PER_GROUP: number;
    NODE_ENV: string;
    CONTACT_URL: string | undefined;
    POSTHOG_API_KEY: string | undefined;
    POSTHOG_URL: string | undefined;
    DISABLE_ANONYMOUS: boolean;
    ENABLE_OPENID: boolean;
    OPID_PROFILE_SCREEN_PROVIDER: string | undefined;
    ENABLE_CHAT_UPLOAD: boolean;
    FALLBACK_LOCALE: string | undefined;
    OPID_WOKA_NAME_POLICY: OpidWokaNamePolicy | undefined;
    ENABLE_REPORT_ISSUES_MENU: boolean | undefined;
    REPORT_ISSUES_URL: string | undefined;
    SENTRY_DSN_FRONT: string | undefined;
    SENTRY_DSN_PUSHER: string | undefined;
    SENTRY_ENVIRONMENT: string | undefined;
    SENTRY_RELEASE: string | undefined;
    SENTRY_TRACES_SAMPLE_RATE: number | undefined;
    WOKA_SPEED: number;
    JITSI_DOMAIN: string | undefined;
    JITSI_XMPP_DOMAIN: string | undefined;
    JITSI_MUC_DOMAIN: string | undefined;
    FEATURE_FLAG_BROADCAST_AREAS: boolean;
    KLAXOON_ENABLED: boolean;
    KLAXOON_CLIENT_ID: string | undefined;
    YOUTUBE_ENABLED: boolean;
    GOOGLE_DRIVE_ENABLED: boolean;
    GOOGLE_DOCS_ENABLED: boolean;
    GOOGLE_SHEETS_ENABLED: boolean;
    GOOGLE_SLIDES_ENABLED: boolean;
    ERASER_ENABLED: boolean;
    PEER_VIDEO_LOW_BANDWIDTH: number;
    PEER_VIDEO_RECOMMENDED_BANDWIDTH: number;
    PEER_SCREEN_SHARE_LOW_BANDWIDTH: number;
    PEER_SCREEN_SHARE_RECOMMENDED_BANDWIDTH: number;
    GOOGLE_DRIVE_PICKER_CLIENT_ID: string | undefined;
    GOOGLE_DRIVE_PICKER_APP_ID: string | undefined;
    EMBEDLY_KEY: string | undefined;
    EJABBERD_DOMAIN: string | undefined;
    EJABBERD_WS_URI: string | undefined;
    MATRIX_PUBLIC_URI : string | undefined;
}
