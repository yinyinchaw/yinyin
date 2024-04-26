<script lang="ts">
    import { IconArrowBackUp, IconArrowDown, IconTrash } from "@tabler/icons-svelte";
    import { ChatMessage } from "../../Connection/ChatConnection";
    import { selectedChatMessageToReply } from "../../Stores/ChatStore";

    export let message: ChatMessage;


    function replyToMessage() {
        selectedChatMessageToReply.set(message);
    }

    function removeMessage(){
        console.debug("Not yet implemented")
    }


</script>


<div class="tw-flex tw-flex-row tw-gap-1 tw-items-center">
    {#if message.type !== "text"}
        <a href={message.content.url} download={message.content.body} class="tw-p-0 tw-m-0 tw-text-white hover:tw-text-white" target="_blank">
            <IconArrowDown size={16} class="hover:tw-cursor-pointer hover:tw-text-cyan-500" />
        </a>
    {/if}
    <button class="tw-p-0 tw-m-0 hover:tw-text-cyan-500"  on:click={replyToMessage}>
        <IconArrowBackUp size={16} />
    </button>
    <button class="tw-p-0 tw-m-0 hover:tw-text-cyan-500"  on:click={removeMessage}>
        <IconTrash size={16} />
    </button>



</div>
