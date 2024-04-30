<script lang="ts">
    import { IconArrowLeft } from "@tabler/icons-svelte";
    import { afterUpdate, onMount } from "svelte";
    import { ChatRoom } from "../../Connection/ChatConnection";
    import { selectedChatMessageToReply, selectedRoom } from "../../Stores/ChatStore";
    import Message from "./Message.svelte";
    import MessageInput from "./MessageInput.svelte";

    export let room: ChatRoom;


    let lastMessageAnchor: HTMLLIElement;

    onMount(() => {
        scrollToMessageListBottom();
    });


    afterUpdate(() => {
        room.setTimelineAsRead();
        scrollToMessageListBottom();
    });

    function scrollToMessageListBottom() {
        lastMessageAnchor.scrollIntoView();
    }

    function goBackAndClearSelectedChatMessage() {
        selectedChatMessageToReply.set(null);
        selectedRoom.set(undefined);
    }

    let messages = room?.messages;
    let messageReaction = room?.messageReactions;

</script>

{#if room !== undefined}
    <button class="tw-p-0 tw-m-0" on:click={goBackAndClearSelectedChatMessage}>
        <IconArrowLeft />
    </button>
    <ul class="tw-list-none tw-p-0 tw-flex-1 tw-overflow-auto tw-flex tw-flex-col">
        {#if $messages.size === 0}
            <p class="tw-self-center tw-text-md tw-text-gray-500">No message</p>
        {/if}
        {#each [...$messages] as [messageId, message] (messageId)}
            <Message {message} reactions={$messageReaction.get(messageId)} />
        {/each}
        <li bind:this={lastMessageAnchor} />
    </ul>
    <MessageInput room={room} />
{/if}

