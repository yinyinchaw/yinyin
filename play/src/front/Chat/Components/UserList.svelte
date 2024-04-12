<script lang="ts">

    import { gameManager } from "../../Phaser/Game/GameManager";
    import NotificationBadge from "./NotificationBadge.svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;

    $: userList = chat.userList;

</script>

    {#each [...$userList] as [userId,user] (userId)}
        <div class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1">
            <div class="tw-relative">
            {#if user.avatarUrl}
                <img src={user.avatarUrl} alt={user.username} />
            {:else}
                <div class={`tw-rounded-full tw-bg-amber-600 tw-h-6 tw-w-6 tw-text-center`}>
                    {user.username?.charAt(0)}
                </div>
            {/if}
                <NotificationBadge type={user.presence === "online" ? "success" : "error"}/>
            </div>
            <p class="tw-m-0">{user.username} ({user.presence})</p>
        </div>
    {/each}

