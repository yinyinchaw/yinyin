<script lang="ts">
    import { IconArrowBackUp, IconTrash } from "@tabler/icons-svelte";
    import { ChatMessage } from "../../Connection/ChatConnection";
    import { selectedChatMessageToReply } from "../../Stores/ChatStore";

    export let message:ChatMessage

    function replyToMessage(){
        selectedChatMessageToReply.set(message)
    }
</script>


<div class="tw-flex tw-flex-row tw-gap-1">
    <button class="tw-p-0 tw-m-0" on:click={replyToMessage}><IconArrowBackUp size={16}/></button>
    <IconTrash size={16}/>
</div>
