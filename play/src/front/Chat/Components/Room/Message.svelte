<script lang="ts">

    import { IconCornerDownRight } from "@tabler/icons-svelte";
    import { ChatMessage } from "../../Connection/ChatConnection";
    import LL, { locale } from "../../../../i18n/i18n-svelte";
    import Avatar from "../Avatar.svelte";

    export let message: ChatMessage;
    const { sender, isMyMessage, date, content, responseTo } = message;
</script>

<li class={`${isMyMessage && "tw-self-end"}`}>
    <div class={`container ${isMyMessage ? "tw-justify-end" : "tw-justify-start"}`}>
        <div
            class={`messageHeader tw-text-gray-500 tw-text-xxs tw-p-0 tw-m-0 tw-flex tw-justify-between ${message.isMyMessage ? "tw-flex-row-reverse" : ""} tw-items-end`}>
            <span>{isMyMessage ? "Me" : sender?.username}</span>
            <span class={`tw-text-xxxs ${isMyMessage ? "tw-mr-1" : "tw-ml-1" }`}>{date?.toLocaleTimeString($locale, {
                hour: "2-digit",
                minute: "2-digit",
            })}</span>
        </div>
        {#if !isMyMessage && sender !== undefined}
            <div class="avatar">
                <Avatar avatarUrl={sender?.avatarUrl} fallbackFirstLetter={sender?.username?.charAt(0)} />
            </div>
        {/if}
        <div class="message tw-bg-brand-blue tw-rounded-md tw-p-2">
            <p class="tw-p-0 tw-m-0 tw-text-xs">
                {#if isMyMessage && content === undefined}
                    {$LL.chat.messageDeletedByYou()}
                {:else}
                    {content}
                {/if}
            </p>
        </div>
        {#if responseTo}
            <div class="response">
                <IconCornerDownRight />
                <svelte:self message={responseTo} />
            </div>
        {/if}
    </div>
</li>

<style>
    .container {
        overflow: auto;
        display: grid;
        grid-gap: 4px;
        grid-template-areas: ". messageHeader" "avatar message" ". response"
    }

    .messageHeader {
        grid-area: messageHeader
    }

    .message {
        grid-area: message;
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .avatar {
        grid-area: avatar
    }

    .response {
        opacity: 50%;
        grid-area: response;
        display: flex;
        flex-direction: row;
        align-items: center;
    }


</style>
