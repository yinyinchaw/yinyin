<script lang="ts">
    import { ChatRoom } from "../../Connection/ChatConnection";

    export let room: ChatRoom;
    let roomName = room.name;
    let displayInvitationRoomActions = false;

    function toggleDisplayInvitationRoomActions() {
        displayInvitationRoomActions = !displayInvitationRoomActions;
    }


</script>

<div
    class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1"
    on:click={toggleDisplayInvitationRoomActions}>
    <div class="tw-relative">
        {#if room.avatarUrl}
            <img src={room.avatarUrl} alt={$roomName} />
        {:else}
            <div class="tw-rounded-full tw-bg-cyan-500 tw-h-6 tw-w-6 tw-text-center">
                {$roomName.charAt(0)}
            </div>
        {/if}
    </div>
    <p class="tw-m-0">{$roomName}</p>
</div>
{#if displayInvitationRoomActions}
    <div class="tw-flex">
        <button class="tw-text-blue-300" on:click={()=>room.joinRoom()}>Accept</button>
        <button class="tw-text-red-500" on:click={()=>room.leaveRoom()}>Decline</button>
    </div>
{/if}