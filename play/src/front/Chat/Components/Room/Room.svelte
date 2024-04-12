<script lang="ts">
    import { ChatRoom } from "../../Connection/ChatConnection";
    import NotificationBadge from "../NotificationBadge.svelte";
    import { selectedRoomId } from "../../Stores/ChatStore";

    export let room: ChatRoom;
</script>

<div
    class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1"
    on:click={()=>selectedRoomId.set(room.id)}>
    <div class="tw-relative">
        {#if room.avatarUrl}
            <img src={room.avatarUrl} alt={room.name} />
        {:else}
            <div class="tw-rounded-full tw-bg-cyan-500 tw-h-6 tw-w-6 tw-text-center">
                {room.name.charAt(0)}
            </div>
        {/if}
        {#if room.hasUnreadMessages}
            <NotificationBadge type="warning"/>
        {/if}
    </div>
    <p class="tw-m-0">{room.name}</p>

</div>