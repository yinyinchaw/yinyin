<script lang="ts">
    import { fly } from "svelte/transition";
    import { enableUserInputsStore } from "../Stores/UserInputStore";
    import { mapEditorModeStore } from "../Stores/MapEditorStore";
    import { chatVisibilityStore } from "../Stores/ChatStore";
    import Chat from "./Components/Chat.svelte";


    function closeChat() {
        console.debug("closed");
        chatVisibilityStore.set(false);
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape" && $chatVisibilityStore) {
            closeChat();
        } else if (e.key === "c" && !$chatVisibilityStore && !$mapEditorModeStore && $enableUserInputsStore) {
            chatVisibilityStore.set(true);
        }
    }

</script>

<svelte:window on:keydown={onKeyDown} />
{#if $chatVisibilityStore}
    <section transition:fly={{ duration: 200,x:-335 }}
         class="chatWindow tw-resize-x tw-overflow-hidden tw-bg-dark-blue/95 tw-p-4">
        <button class="close-window" on:click={closeChat}>&#215;</button>
        <Chat />
    </section>
{/if}


<style lang="scss">
  @import "../style/breakpoints.scss";

  @include media-breakpoint-up(sm) {
    .chatWindow {
      width: 100% !important;
    }
  }

  .chatWindow {
    color: white;
    display: flex;
    flex-direction: column;
    position: absolute !important;
    top: 0;
    min-width: 335px !important;
    height: 100vh !important;
    z-index: 2000;
    pointer-events: auto;
    .close-window {
      cursor: pointer;
      align-self: end;
    }
  }
</style>
