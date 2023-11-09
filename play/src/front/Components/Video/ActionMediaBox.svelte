<script lang="ts">
    import { EmbedScreen, highlightedEmbedScreen } from "../../Stores/HighlightedEmbedScreenStore";
    import MoreActionSvg from "../images/ellipsis.svg";
    import MicrophoneCloseSvg from "../images/microphone-close.svg";
    import banUserSvg from "../images/ban-user.svg";
    import NoVideoSvg from "../images/no-video.svg";
    import PinSvg from "../images/pin.svg";
    import BubbleTalkPng from "../images/bubble-talk.png";
    import { TackStreamWrapper } from "../../Streaming/Contract/TackStreamWrapper";

    export let embedScreen: EmbedScreen;
    export let trackStreamWraper: TackStreamWrapper;

    let moreActionOpened = false;

    function muteAudio() {
        trackStreamWraper.muteAudio();
    }

    function muteAudioEveryBody() {
        trackStreamWraper.muteAudioEveryBody();
    }

    function muteVideo() {
        trackStreamWraper.muteVideo();
    }

    function muteVideoEveryBody() {
        trackStreamWraper.muteAudioEveryBody();
    }

    function ban() {
        trackStreamWraper.ban();
    }

    function pin() {
        highlightedEmbedScreen.toggleHighlight(embedScreen);
    }

    function sendPrivateMessage() {}
</script>

<div
    class="tw-absolute tw-bottom-0 tw-right-0 tw-flex tw-flex-col tw-justify-between tw-items-center tw-p-1 tw-bg-black tw-bg-opacity-50 tw-rounded-lg"
>
    <div class="tw-flex tw-flex-row tw-items-center tw-justify-center">
        <!-- Send private message -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => sendPrivateMessage()}
        >
            <img src={BubbleTalkPng} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Pin -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => pin()}
        >
            <img src={PinSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Stope video every body -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => muteVideoEveryBody()}
        >
            <img src={NoVideoSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Stope video -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => muteVideo()}
        >
            <img src={NoVideoSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Ban user -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => ban()}
        >
            <img src={banUserSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Mute every body -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => muteAudioEveryBody()}
        >
            <img src={MicrophoneCloseSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <!-- Mute user -->
        <button
            class={`tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer ${
                !moreActionOpened ? "tw-opacity-0" : ""
            }`}
            on:click|preventDefault|stopPropagation={() => muteAudio()}
        >
            <img src={MicrophoneCloseSvg} class="tw-w-4 tw-h-4" alt="Ellipsis icon" />
        </button>
        <button
            class="tw-flex tw-flex-row tw-items-center tw-justify-center tw-p-0 tw-mx-1 tw-cursor-pointer"
            on:click|preventDefault|stopPropagation={() => (moreActionOpened = !moreActionOpened)}
        >
            <img
                src={MoreActionSvg}
                class={`tw-w-4 tw-h-4 ${moreActionOpened ? "tw-rotate-180" : ""}`}
                alt="Ellipsis icon"
            />
        </button>
    </div>
</div>
