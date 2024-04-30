<script lang="ts">
    import { ChatMessageReaction } from "../../Connection/ChatConnection";
    import { MapStore } from "@workadventure/store-utils";
    import { get } from "svelte/store";

    export let reactions: MapStore<string, ChatMessageReaction>;

</script>


<div class="tw-flex tw-flex-row tw-gap-1 tw-mt-1">
    {#each [...$reactions] as [reactionKey,reaction](reactionKey)}
        <div class="tw-flex tw-flex-row tw-gap-1 tw-border tw-border-solid tw-border-light-purple tw-rounded-md tw-p-1">
            <p class="tw-text-xxs tw-p-0 tw-m-0">{reaction.key}</p>
            <p class="tw-text-xxs tw-p-0 tw-m-0">{get(reaction.users).size}</p>
        </div>
    {/each}
</div>