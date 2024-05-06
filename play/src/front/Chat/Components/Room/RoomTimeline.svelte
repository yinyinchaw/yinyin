<script lang="ts">
    import { IconArrowLeft } from "@tabler/icons-svelte";
    import { afterUpdate, onMount } from "svelte";
    import { get } from "svelte/store";
    import { ChatRoom } from "../../Connection/ChatConnection";
    import { selectedChatMessageToReply, selectedRoom } from "../../Stores/ChatStore";
    import Message from "./Message.svelte";
    import MessageInput from "./MessageInput.svelte";

    export let room: ChatRoom;

    let messageListRef: HTMLUListElement;

     async function loadMorePreviousMessages(){
        while(messageListRef.scrollTop===0 && get(room.hasPreviousMessage)) {
            // eslint-disable-next-line no-await-in-loop
             await room.loadMorePreviousMessages()
        }
    }

    onMount(() => {
        scrollToMessageListBottom();
        loadMorePreviousMessages().catch(error=>console.error(error))
    })

    afterUpdate(() => {
        room.setTimelineAsRead();
        const oldFirstLi = messageListRef.querySelector<HTMLLIElement>('li[data-first-li="true"]');
        if (oldFirstLi){
            messageListRef.scrollTop = oldFirstLi.getBoundingClientRect().top - messageListRef.getBoundingClientRect().top
            oldFirstLi.removeAttribute("data-first-li")
        }
        else{
            scrollToMessageListBottom();
        }

        const firstListItem = messageListRef.children.item(0);
        firstListItem?.setAttribute("data-first-li","true");
    });


    function scrollToMessageListBottom() {
        messageListRef.scrollTop = messageListRef.scrollHeight;
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
    <ul on:scroll={()=>loadMorePreviousMessages()} bind:this={messageListRef} class="tw-list-none tw-p-0 tw-flex-1 tw-overflow-auto tw-flex tw-flex-col">
        {#if $messages.length === 0}
            <p class="tw-self-center tw-text-md tw-text-gray-500">No message</p>
        {/if}
        {#each $messages as message (message.id)}
            <li>
                <Message {message} reactions={$messageReaction.get(message.id)} />
            </li>
        {/each}
    </ul>
    <MessageInput room={room} />
{/if}

