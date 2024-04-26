<script lang="ts">
    import { ChatMessageContent } from "../../../Connection/ChatConnection";

    export let content:ChatMessageContent;
</script>

<audio controls src={content.url} class="tw-h-10 tw-w-48"></audio>


