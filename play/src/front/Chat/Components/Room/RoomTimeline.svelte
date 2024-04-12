<script lang="ts">
    import { IconArrowLeft } from "@tabler/icons-svelte";
    import { onMount } from "svelte";
    import { ChatRoom } from "../../Connection/ChatConnection";
    import { selectedRoomId } from "../../Stores/ChatStore";

    export let room: ChatRoom | undefined = undefined;

    let message: string;
    let messageInput:HTMLInputElement;

    function sendMessage(message: string) {
        room?.sendMessage(message);
        message = "";
        messageInput.value = "";
    }

    onMount(() => {
        if (room !== undefined) {
            room.setTimelineAsRead();
        }
    });

</script>

{#if room !== undefined}
    <button class="tw-p-0 tw-m-0" on:click={()=>selectedRoomId.set(undefined)}>
        <IconArrowLeft />
    </button>
    <div
        class="tw-flex-1 tw-overflow-auto">
        <ul class="tw-list-none tw-p-0 tw-flex tw-flex-col">
            {#each room.messages as message (message.id)}
                <li class={`tw-w-fit ${message.isMyMessage && "tw-self-end"}`}>
                    <p class="tw-text-gray-500 tw-text-xxs tw-p-0 tw-m-0">{message.date?.toLocaleTimeString()}</p>
                    <div class="tw-bg-dark-blue tw-rounded-md tw-p-2">
                        <p class="tw-p-0 tw-m-0 tw-text-xs">{message.content}</p>
                    </div>

                </li>
            {/each}
        </ul>
    </div>
    <div>
        <form on:submit|preventDefault={()=>sendMessage(message)}>
        <input bind:value={message}
               bind:this={messageInput}
               class="tw-w-full tw-rounded-xl wa-searchbar tw-block tw-text-white placeholder:tw-text-sm tw-px-3 tw-py-1 tw-border-light-purple tw-border tw-border-solid tw-bg-transparent" placeholder="Type your message" />
        </form>
    </div>
{/if}



