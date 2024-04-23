<script lang="ts">
    import { IconArrowLeft } from "@tabler/icons-svelte";
    import { afterUpdate } from "svelte";
    import { ChatRoom } from "../../Connection/ChatConnection";
    import { selectedRoom } from "../../Stores/ChatStore";
    import Message from "./Message.svelte";

    export let room: ChatRoom;

    let message: string;
    let messageInput: HTMLInputElement;

    function sendMessage(message: string) {
        room?.sendMessage(message);
        message = "";
        messageInput.value = "";
    }

    afterUpdate(()=>{
        room.setTimelineAsRead();
    })

    let messages = room?.messages;

</script>

{#if room !== undefined}
    <button class="tw-p-0 tw-m-0" on:click={()=>selectedRoom.set(undefined)}>
        <IconArrowLeft />
    </button>
        <ul class="tw-list-none tw-p-0 tw-flex-1 tw-overflow-auto tw-flex tw-flex-col test">
            {#if $messages.length === 0}
                <p class="tw-self-center tw-text-md tw-text-gray-500">No message</p>
            {/if}
            {#each $messages as message (message.id)}
               <Message {message}/>
            {/each}
        </ul>
    <div>
        <form on:submit|preventDefault={()=>sendMessage(message)}>
            <input bind:value={message}
                   bind:this={messageInput}
                   class="tw-w-full tw-rounded-xl wa-searchbar tw-block tw-text-white placeholder:tw-text-sm tw-px-3 tw-py-1 tw-border-light-purple tw-border tw-border-solid tw-bg-transparent"
                   placeholder="Type your message" />
        </form>
    </div>
{/if}
