<script lang="ts">
    import { ChatRoom } from "../../Connection/ChatConnection";
    import NotificationBadge from "../NotificationBadge.svelte";
    import { selectedRoom } from "../../Stores/ChatStore";
    import Avatar from "../Avatar.svelte";

    export let room: ChatRoom;

    let hasUnreadMessage = room.hasUnreadMessages
    let roomName = room.name

</script>

<div
    class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1"
    on:click={()=> selectedRoom.set(room)}>
    <div class="tw-relative">
        <Avatar avatarUrl={room.avatarUrl} fallbackFirstLetter={$roomName.charAt(0)}/>
        {#if $hasUnreadMessage}
            <NotificationBadge type="warning" />
        {/if}
    </div>
    <p class="tw-m-0">{$roomName}</p>

</div>