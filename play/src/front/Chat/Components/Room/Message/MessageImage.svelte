<script lang="ts">
    import { ChatMessageContent } from "../../../Connection/ChatConnection";

    export let content:ChatMessageContent
</script>

<img class="tw-w-full tw-object-contain tw-max-h-52" src={content.url} alt={content.body} />
