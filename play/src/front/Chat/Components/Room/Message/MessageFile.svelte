<script lang="ts">
    import { IconPaperclip } from "@tabler/icons-svelte";
    import { ChatMessageContent } from "../../../Connection/ChatConnection";

    export let content: ChatMessageContent;
</script>

<a href={content.url} download class="tw-text-xs">
    <IconPaperclip />
    {content.body}
</a>
