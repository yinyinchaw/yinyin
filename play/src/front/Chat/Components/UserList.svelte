<script lang="ts">

    import { IconChevronDown, IconChevronRight, IconUserCircle } from "@tabler/icons-svelte";
    import { gameManager } from "../../Phaser/Game/GameManager";

    const chat = gameManager.getCurrentGameScene().chatConnection;

    let displayList = true;

    function toggleDisplayList() {
        displayList = !displayList;
    }
    $: chatMembers = chat.chatMembers;

</script>


<button class="tw-p-0 tw-m-0 tw-text-gray-400" on:click={toggleDisplayList}>
    {#if displayList}
        <IconChevronDown />
    {:else}
        <IconChevronRight />
    {/if}
    Users
</button>
{#if displayList}
    {#each $chatMembers as chatMember (chatMember.id)}
        <div class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1">
            <IconUserCircle color={chatMember.presence === "offline" ? "red" : "green"} />
            <p class="tw-m-0">{chatMember.username} ({chatMember.presence})</p>
        </div>
    {/each}
{/if}
