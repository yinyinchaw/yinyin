<script lang="ts">
    import { gameManager } from "../../../Phaser/Game/GameManager";
    import UserList from "./UserList.svelte";
    import { ChatUser } from "../../Connection/ChatConnection";
    import { LL } from "../../../../i18n/i18n-svelte";
    import { chatSearchBarValue, shownRoomListStore } from "../../Stores/ChatStore";
    import { ChevronUpIcon } from "svelte-feather-icons";
    import {  onMount } from "svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;
    const DISCONNECTED_LABEL = 'disconnected'; 
    const DISCONNECTED_USERS_LIMITATION = 200;

    onMount(() => {
        if($shownRoomListStore==="")
            shownRoomListStore.set($LL.chat.userList.isHere());
    });

    $: userList = chat.userList;
    $: filterUsers = Array.from($userList)
        .map(([_,user])=>user)
        .filter((user)=>(user.username)?user.username.toLocaleLowerCase().includes($chatSearchBarValue):false ) || [];

    $: usersByRoom = filterUsers.reduce((acc,curr)=>{
        let room = curr.roomName ?? DISCONNECTED_LABEL;

        room = (room === gameManager?.getCurrentGameScene()?.room?.roomName )? $LL.chat.userList.isHere() :room;
        const userList : Array<ChatUser> = acc.get(room) ?? [];

        userList.push(curr);
        acc.set(room,userList);

        return acc;

    },new Map<string,ChatUser[]>()) as Map<string,ChatUser[]>;

    
    $: disconnectedUsers   = usersByRoom.get(DISCONNECTED_LABEL)?.slice(0,DISCONNECTED_USERS_LIMITATION);
    $: usersByRoom?.delete(DISCONNECTED_LABEL);

    $: onThisMapUsers = usersByRoom.get($LL.chat.userList.isHere());
    $: usersByRoom?.delete($LL.chat.userList.isHere())

    $: roomsWithUsers = [[$LL.chat.userList.isHere(),onThisMapUsers],
    ...Array.from(usersByRoom?.entries()||[])
        .sort(([aKey,_aValue] : [string,ChatUser[]],[bKey,_bValue]:[string,ChatUser[]])=>aKey.localeCompare(bKey)),
    [DISCONNECTED_LABEL,disconnectedUsers??[]]] as Array<[string,ChatUser[]]>;


</script>

{#each roomsWithUsers as [roomName,userInRoom]}
    {#if userInRoom && userInRoom.length > 0}
        <div class ="users tw-border-b tw-border-solid tw-border-0 tw-border-transparent tw-border-b-light-purple">
            <div class="tw-px-4 tw-py-1 tw-flex tw-items-center">
                <span
                    class="{roomName !== DISCONNECTED_LABEL
                        ? 'tw-bg-light-blue'
                        : 'tw-bg-gray'} tw-text-dark-purple tw-min-w-[20px] tw-h-5 tw-mr-3 tw-text-sm tw-font-semibold tw-flex tw-items-center tw-justify-center tw-rounded"
                >
                {#if userInRoom?.length && userInRoom.length > 0}
                    {userInRoom?.length}
                {/if}
                </span>
                <p class="tw-text-light-blue tw-mb-0 tw-text-sm tw-flex-auto">
                    {roomName}
                </p>
                <button
                class="tw-text-lighter-purple"
                on:click={() => shownRoomListStore.set($shownRoomListStore === roomName ? "" : roomName)}>
                <ChevronUpIcon class={`tw-transform tw-transition ${$shownRoomListStore === roomName ? "" : "tw-rotate-180"}`}/>
                </button>
            </div>
            {#if $shownRoomListStore === roomName}
                <UserList userList={userInRoom}/>  
            {/if} 
        </div>
    {/if}
{/each}


