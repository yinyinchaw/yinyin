<script lang="ts">
    import { ShieldIcon, UsersIcon } from "svelte-feather-icons";
    import AvailabilityStatusCircle from "../../../Components/ActionBar/AvailabilityStatus/AvailabilityStatusCircle.svelte";
    import { localUserStore } from "../../../Connection/LocalUserStore";
    import { availabilityStatusStore } from "../../../Stores/MediaStore";
    import { getColorHexOfStatus } from "../../../Utils/AvailabilityStatus";
    import { ChatUser } from "../../Connection/ChatConnection";
    import UserActionButton from "./UserActionButton.svelte";
    import { LL } from "../../../../i18n/i18n-svelte";
    import { AvailabilityStatus } from "@workadventure/messages";
    import highlightWords from "highlight-words";
    import { gameManager } from "../../../Phaser/Game/GameManager";
    import { navChat, selectedRoom } from "../../Stores/ChatStore";

    export let user:ChatUser;
    export let searchText : string;
    let isMe = (user.id===localUserStore.getChatId());

    $: availabilityStatus = (isMe) ? availabilityStatusStore : user.availabilityStatus; 

    let chatConnection = gameManager.getCurrentGameScene().chatConnection
    //TODO : set related to status 
    ///let isActive : boolean = true;  

    $: chunks = highlightWords({
        text: user?.username.match(/\[\d*]/) ? user?.username.substring(0, user?.username.search(/\[\d*]/)) : user.username,
        query: searchText,
    });

    /*
    4) revoir woka image avec fond
    5)recherche par nom 
    */

    function getNameOfAvailabilityStatus(status: AvailabilityStatus) {
        switch (status) {
            case AvailabilityStatus.ONLINE : 
                return $LL.chat.status.online();
            case AvailabilityStatus.AWAY:
                return $LL.chat.status.away();
            case AvailabilityStatus.BUSY:
                return $LL.chat.status.busy();
            case AvailabilityStatus.DO_NOT_DISTURB:
                return $LL.chat.status.do_not_disturb();
            case AvailabilityStatus.BACK_IN_A_MOMENT:
                return $LL.chat.status.back_in_a_moment();
            case AvailabilityStatus.SILENT:
            default:
                return $LL.chat.status.unavailable();
        }
    }
   
    const openChat = async (userId: string) =>{
        if(isMe)return;
        const room = await chatConnection.createDirectRoom(userId);
        selectedRoom.set(room)
        navChat.set("chat")
    }
    

</script>
 <!-- svelte-ignore a11y-click-events-have-key-events -->
<div 
on:click|stopPropagation={openChat(user.id)}
class="tw-text-md tw-flex tw-gap-2 tw-flex-row tw-items-center tw-justify-between hover:tw-bg-white hover:tw-bg-opacity-10 hover:tw-rounded-md hover:!tw-cursor-pointer tw-p-1">
   
    <div
    class={`wa-chat-item ${user.isAdmin ? "admin" : "user"}  tw-cursor-default`}
  
>
    <div
        class={`tw-relative wa-avatar ${!$availabilityStatus && "tw-opacity-50"}  tw-cursor-default`}
        style={`background-color: ${user.color}`}

    >
        <div class="wa-container  tw-cursor-default">
            <img
                class="tw-w-full  tw-cursor-default"
                style="image-rendering: pixelated;"
                src={user.avatarUrl}
                alt="Avatar"
            />
        </div>
        {#if $availabilityStatus}
            <span
                title={getNameOfAvailabilityStatus($availabilityStatus)}
                class={`status tw-w-4 tw-h-4 tw-cursor-default tw-block tw-rounded-full tw-absolute tw-right-0 tw-top-0 tw-transform tw-translate-x-2 -tw-translate-y-1 tw-border-solid tw-border-2 tw-border-light-purple`}
                style="--color:{getColorHexOfStatus($availabilityStatus)}"
            />
        {/if}
    </div>
    <div
    class={`tw-flex-auto tw-ml-3 ${!$availabilityStatus && "tw-opacity-50"}  tw-cursor-default`}
    
>
    <h1 class={`tw-text-sm tw-font-bold tw-mb-0  tw-cursor-default`}>
        {#each chunks as chunk (chunk.key)}
        <span class={`${chunk.match ? "tw-text-light-blue" : ""}  tw-cursor-default`}>{chunk.text}</span>
        {/each}
        {#if user.username.match(/\[\d*]/)}
            <span class="tw-font-light tw-text-xs tw-text-gray  tw-cursor-default">
                #{user.username
                    .match(/\[\d*]/)
                    ?.join()
                    ?.replace("[", "")
                    ?.replace("]", "")}
            </span>
        {/if}
        {#if user.isAdmin}
        <span class="tw-text-warning" title={$LL.chat.role.admin()}>
            <ShieldIcon size="13" />
        </span>
    {/if}
    {#if user.isMember}
        <span title={$LL.chat.role.member()}>
            <UsersIcon size="13" />
        </span>
    {/if}
    </h1>
    <p class="tw-text-xs tw-mb-0 tw-font-condensed tw-opacity-75  tw-cursor-default tw-self-end">
        {#if isMe}
            {$LL.chat.you()}
        {:else if $availabilityStatus}
            {getNameOfAvailabilityStatus($availabilityStatus ?? 0)}
        {:else}
            {$LL.chat.userList.disconnected()}
        {/if}
    </p>
</div>
</div>
    {#if $availabilityStatus && !isMe}
        <UserActionButton {user}/>
    {/if}
</div>

<style lang="scss">
    .status {
        background-color: var(--color);
    }
</style>