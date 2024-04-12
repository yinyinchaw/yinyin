<script lang="ts">

    import { IconChevronDown, IconChevronRight, IconSquarePlus } from "@tabler/icons-svelte";
    import { gameManager } from "../../Phaser/Game/GameManager";
    import LL from "../../../i18n/i18n-svelte";
    import { selectedRoomId } from "../Stores/ChatStore";
    import Room from "./Room/Room.svelte";
    import RoomTimeline from "./Room/RoomTimeline.svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;

    let displayRoomMemberList = true;
    let displayRoomList = true;
    let displayAddRoomForm = false;

    function toggleDisplayMemberRoomList() {
        displayRoomMemberList = !displayRoomMemberList;
    }

    function toggleDisplayRoomList() {
        displayRoomList = !displayRoomList;
    }

    $: roomList = chat.roomList;

</script>

{#if $selectedRoomId !== undefined}
    <RoomTimeline room={$roomList.get($selectedRoomId)} />
{:else}
    <button class="tw-p-0 tw-m-0 tw-text-gray-400" on:click={toggleDisplayMemberRoomList}>
        {#if displayRoomMemberList}
            <IconChevronDown />
        {:else}
            <IconChevronRight />
        {/if}
        {$LL.chat.people()}
    </button>
    {#if displayRoomMemberList}
        {#each [...$roomList].filter(([_, room]) => room.type === "direct") as [roomId, room] (roomId)}
            <Room {room} />
        {/each}
    {/if}

    <div class="tw-flex tw-justify-between">
        <button class="tw-p-0 tw-m-0 tw-text-gray-400" on:click={toggleDisplayRoomList}>
            {#if displayRoomList}
                <IconChevronDown />
            {:else}
                <IconChevronRight />
            {/if}
            {$LL.chat.rooms()}</button>
        <button class="tw-p-0 tw-m-0 tw-text-gray-400"><IconSquarePlus size={16}/></button>
    </div>

    {#if displayAddRoomForm}

    {/if}


    {#if displayRoomList}
        {#each [...$roomList].filter(([_, room]) => room.type === "multiple") as [roomId, room] (roomId)}
            <Room {room} />
        {/each}
    {/if}


{/if}


