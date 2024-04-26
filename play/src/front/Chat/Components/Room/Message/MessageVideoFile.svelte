<script lang="ts">
    import { ChatMessageContent } from "../../../Connection/ChatConnection";

    export let content: ChatMessageContent;
    const url = content.url;
</script>

{#if url !== undefined}
    <video controls class="tw-w-full">
        <source src={url} />
    </video>
{/if}



