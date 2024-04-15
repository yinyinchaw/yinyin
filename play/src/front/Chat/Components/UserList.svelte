<script lang="ts">

    import { gameManager } from "../../Phaser/Game/GameManager";
    import User from "./User.svelte";

    const chat = gameManager.getCurrentGameScene().chatConnection;

    $: userList = chat.userList;

</script>

    {#each [...$userList] as [userId,user] (userId)}
      <User {user}/>
    {/each}

