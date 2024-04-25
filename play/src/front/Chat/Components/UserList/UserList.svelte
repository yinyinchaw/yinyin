<script lang="ts">
    import User from "./User.svelte";
    import { ChatUser } from "../../Connection/ChatConnection";
    import { localUserStore } from "../../../Connection/LocalUserStore";


    export let searchText : string;
    export let userList : Array<ChatUser> = [];

    const me : ChatUser|null = userList.reduce((acc : ChatUser | null,curr)=>{
        if(acc!==null || curr.id !== localUserStore.getChatId())return acc;
        return curr;
    },null);

    $: filteredAndSortedUserList = userList
    ?.filter((user : ChatUser)=> (me)?user.id!==me.id : true )
    .toSorted((a,b)=>a.username?.localeCompare(b.username||"")||-1) || [];

</script>

    {#if me && me.username?.toLocaleLowerCase().includes(searchText)}
        <User user={me} {searchText} />
    {/if}

    {#each [...filteredAndSortedUserList] as user (user.id)}
        <User {user} {searchText} />
    {/each}



