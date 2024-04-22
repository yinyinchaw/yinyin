<script lang="ts">

    import { ChatMessage } from "../../Connection/ChatConnection";
    import LL, { locale } from "../../../../i18n/i18n-svelte";
    import Avatar from "../Avatar.svelte";

    export let message: ChatMessage;
</script>

<li class={`${message.isMyMessage && "tw-self-end"} tw-max-w-[50%]`}>
    <div class={`container ${message.isMyMessage ? "tw-justify-end" : "tw-justify-start"}`}>
        <div
            class={`messageHeader tw-text-gray-500 tw-text-xxs tw-p-0 tw-m-0 tw-flex tw-justify-between ${message.isMyMessage ? "tw-flex-row-reverse" : ""} tw-items-end`}>
            <span>{message.isMyMessage ? "Me" : message.user?.username}</span>
            <span class={`tw-text-xxxs ${message.isMyMessage ? "tw-mr-1" : "tw-ml-1" }`}>{message.date?.toLocaleTimeString($locale,{
                hour: "2-digit",
                minute: "2-digit",
            })}</span>
        </div>
        {#if !message.isMyMessage && message.user !== undefined}
            <div class="avatar">
                <Avatar avatarUrl={message.user.avatarUrl} fallbackFirstLetter={message.user.username?.charAt(0)} />
            </div>
        {/if}
        <div class="message tw-bg-brand-blue tw-rounded-md tw-p-2">
            <p class="tw-p-0 tw-m-0 tw-text-xs">
                {#if message.isMyMessage && message.content === undefined}
                    {$LL.chat.messageDeletedByYou()}
                {:else}
                    {message.content}
                {/if}

            </p>
        </div>
    </div>


</li>

<style>
    .container {
        display: grid;
        grid-gap: 4px;
        grid-template-areas: ". messageHeader" "avatar message";
    }

    .messageHeader {
        grid-area: messageHeader
    }

    .message {
        grid-area: message

    }

    .avatar {
        grid-area: avatar
    }


</style>
