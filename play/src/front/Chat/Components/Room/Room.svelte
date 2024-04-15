<script lang="ts">
    import { ChatRoom } from "../../Connection/ChatConnection";
    import NotificationBadge from "../NotificationBadge.svelte";
    import { selectedRoom } from "../../Stores/ChatStore";

    export let room: ChatRoom;

    let hasUnreadMessage = room.hasUnreadMessages
    let roomName = room.name

</script>

<div
    class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1"
    on:click={()=> selectedRoom.set(room)}>
    <div class="tw-relative">
        {#if room.avatarUrl}
            <img src={room.avatarUrl} alt={$roomName} />
        {:else}
            <div class="tw-rounded-full tw-bg-cyan-500 tw-h-6 tw-w-6 tw-text-center">
                {$roomName.charAt(0)}
            </div>
        {/if}
        {#if $hasUnreadMessage}
            <NotificationBadge type="warning" />
        {/if}
    </div>
    <p class="tw-m-0">{$roomName}</p>

</div>