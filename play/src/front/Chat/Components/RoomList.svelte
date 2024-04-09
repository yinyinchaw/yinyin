<script lang="ts">

    import { IconChevronDown, IconChevronRight, IconMessage } from "@tabler/icons-svelte";
    import { gameManager } from "../../Phaser/Game/GameManager";

    const chat = gameManager.getCurrentGameScene().chatConnection;

    let displayList = true;

    function toggleDisplayList() {
        displayList = !displayList;
    }

    $: roomList = chat.roomList;

</script>


<button class="tw-p-0 tw-m-0 tw-text-gray-400" on:click={toggleDisplayList}>
    {#if displayList}
        <IconChevronDown />
    {:else}
        <IconChevronRight />
    {/if}
    Rooms
</button>
{#if displayList}
    {#each [...$roomList] as [roomId, room] (roomId)}
        <div
            class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1">
            <IconMessage />
            <p class="tw-m-0">{room.name}</p>
            {#if room.hasUnreadMessages}
                <p>UnreadMessage test</p>
            {/if}
        </div>
    {/each}
{/if}
