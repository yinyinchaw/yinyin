<script lang="ts">
    import { ChatUser } from "../Connection/ChatConnection";
    import NotificationBadge from "./NotificationBadge.svelte";
    import Avatar from "./Avatar.svelte";

    export let user: ChatUser;

    let presence = user.presence;
</script>
<div
    class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1">
    <div class="tw-relative">
        <Avatar avatarUrl={user.avatarUrl} fallbackFirstLetter={user.username?.charAt(0)} />
        <NotificationBadge type={$presence === "online" ? "success" : "error"} />
    </div>
    <p class="tw-m-0">{user.username}</p>
</div>