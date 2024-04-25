<script lang="ts">
    import { IconLoader3 } from "@tabler/icons-svelte";
    import { gameManager } from "../../Phaser/Game/GameManager";
    import LL from "../../../i18n/i18n-svelte";
    import { navChat } from "../Stores/ChatStore";
    import RoomUserList from "./UserList/RoomUserList.svelte";
    import RoomList from "./RoomList.svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;
    $: chatConnectionStatus = chat.connectionStatus;

    let searchValue = "";

</script>

<div class="tw-flex tw-flex-col tw-gap-2 tw-h-full">
    {#if $chatConnectionStatus === "CONNECTING"}
        <div class="tw-text-gray-400 tw-text-xl tw-flex tw-flex-col tw-items-center tw-mt-20">
            <IconLoader3 class="tw-animate-spin" size={40} />
            <p class="tw-m-0">
                {$LL.chat.connecting()}
            </p>
        </div>
    {/if}
    {#if $chatConnectionStatus === "ON_ERROR"}
        <p class="tw-text-red-500">Something went wrong with chat</p>
    {/if}
    {#if $chatConnectionStatus === "ONLINE"}
        <nav class="nav">
            <div class="background" class:chat={$navChat === "chat"} />
            <ul>
                <li class:active={$navChat === "users"} on:click={() => navChat.set("users")}>
                    {$LL.chat.users()}
                </li>
                <li class:active={$navChat === "chat"} on:click={() => navChat.set("chat")}>{$LL.chat.chat()}</li>
            </ul>
        </nav>
        <!-- searchbar -->
        <div class="tw-border tw-border-transparent tw-border-b-light-purple tw-border-solid">
            <div class="tw-p-3">
                <input
                    class="wa-searchbar tw-block tw-text-white tw-w-full placeholder:tw-text-sm tw-rounded-3xl tw-px-3 tw-py-1 tw-border-light-purple tw-border tw-border-solid tw-bg-transparent"
                    placeholder={$navChat === "users" ? $LL.chat.searchUser() : $LL.chat.searchChat()}
                    bind:value={searchValue}
                />
            </div>
        </div>
        {#if $navChat === "users"}
            <RoomUserList searchText={searchValue}/>
        {:else}
            <RoomList />
        {/if}
    {/if}
</div>

<audio id="newMessageSound" src="./static/new-message.mp3" style="width: 0;height: 0;opacity: 0" />

