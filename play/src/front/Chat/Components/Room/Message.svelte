<script lang="ts">

    import { IconCornerDownRight } from "@tabler/icons-svelte";
    import { ChatMessage } from "../../Connection/ChatConnection";
    import LL, { locale } from "../../../../i18n/i18n-svelte";
    import Avatar from "../Avatar.svelte";
    import MessageOptions from "./MessageOptions.svelte";

    export let message: ChatMessage;
    const { sender, isMyMessage, date, content, quotedMessage, isQuotedMessage } = message;


</script>

<li class={`${isMyMessage && "tw-self-end tw-flex-row-reverse"}`}>
    <div class={`container-grid ${isMyMessage ? "tw-justify-end grid-container-inverted" : "tw-justify-start"}`}>
        <div
            class={`messageHeader tw-text-gray-500 tw-text-xxs tw-p-0 tw-m-0 tw-flex tw-justify-between ${message.isMyMessage ? "tw-flex-row-reverse" : ""} tw-items-end`}
            hidden={isQuotedMessage}>
            <span>{isMyMessage ? "You" : sender?.username}</span>
            <span class={`tw-text-xxxs ${isMyMessage ? "tw-mr-1" : "tw-ml-1" }`}>{date?.toLocaleTimeString($locale, {
                hour: "2-digit",
                minute: "2-digit",
            })}</span>
        </div>
        {#if (!isMyMessage || isQuotedMessage) && sender !== undefined}
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
        {#if quotedMessage}
            <div class="response">
                <IconCornerDownRight />
                <svelte:self message={quotedMessage} />
            </div>
        {/if}
    </div>
    {#if !isQuotedMessage}
        <div class={`options tw-bg-white/30 tw-p-1 tw-rounded-md ${!isMyMessage ? "tw-left-6" : ""}`}>
            <MessageOptions message={message} />
        </div>
    {/if}
</li>

<style>

    li {
        display: flex;
        align-items: flex-start;
        position: relative;
    }

    li:hover .options {
        display: block;
        flex-direction: row;
        gap: 2px;
    }

    .options {
        display: none;
        position: absolute;
    }

    .container-grid {
        overflow: auto;
        display: grid;
        grid-gap: 4px;
        grid-template-areas: ". messageHeader" "avatar message" ". response";
    }

    .messageHeader {
        grid-area: messageHeader
    }

    .message {
        grid-area: message;
        min-width: 0;
        overflow-wrap: anywhere;
        position: relative;

    }

    .avatar {
        grid-area: avatar
    }

    .response {
        opacity: 50%;
        grid-area: response;
        display: flex;
        flex-direction: row;
    }


</style>
