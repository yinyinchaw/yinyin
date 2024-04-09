<script lang="ts">
    import { IconLoader } from "@tabler/icons-svelte";
    import { gameManager } from "../../Phaser/Game/GameManager";
    import UserList from "./UserList.svelte";
    import RoomList from "./RoomList.svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;
    $: chatConnectionStatus = chat.connectionStatus;

</script>

<div class="tw-flex tw-flex-col tw-gap-2">
    {#if $chatConnectionStatus === "CONNECTING"}
        <div class="tw-flex tw-justify-center tw-items-center">
            <p class="tw-m-0">
                <IconLoader class="tw-animate-spin" />
                Connecting to chat
            </p>
        </div>
    {/if}
    {#if $chatConnectionStatus === "ON_ERROR"}
        <p class="tw-text-red-500">Something went wrong with chat</p>
    {/if}
    {#if $chatConnectionStatus === "ONLINE"}
        <input class="tw-rounded-xl tw-bg-[#1B2A41] tw-border !tw-border-[#879FC2] tw-text-blue-gray-700 tw-outline tw-outline-0 focus:tw-outline-0 tw-text-white tw-shadow-none"  placeholder="Search"/>
        <UserList />
        <RoomList/>
    {/if}
</div>

<audio id="newMessageSound" src="./static/new-message.mp3" style="width: 0;height: 0;opacity: 0" />



