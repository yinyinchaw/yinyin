<script lang="ts">
    import { ChatMessageContent } from "../../../Connection/ChatConnection";

    export let content: ChatMessageContent;

</script>

<p class="tw-p-0 tw-m-0 tw-text-xs">
    {content.body}
</p>
