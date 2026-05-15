import { siApple, siApplemusic, siBattledotnet, siBluesky, siDropbox, siCursor, siDiscord, siEpicgames, siFigma, siFirefox, siGithub, siGmail, siGoogledrive, siGooglechrome, siGooglemeet, siInstagram, siItunes, siMessenger, siNetflix, siNotion, siObsidian, siOpera, siPaypal, siPlaystation, siReddit, siSafari, siSignal, siSpotify, siSteam, siTelegram, siTidal, siTiktok, siTwitch, siWhatsapp, siX, siYoutube, siZoom, siVscodium } from "simple-icons";
export function resolveBrandIcon(appId, appName) {
    const haystack = `${appId} ${appName}`.toLowerCase();
    if (haystack.includes("apple music"))
        return siApplemusic;
    if (haystack.includes("itunes"))
        return siItunes;
    if (haystack.includes("apple"))
        return siApple;
    if (haystack.includes("spotify"))
        return siSpotify;
    if (haystack.includes("youtube"))
        return siYoutube;
    if (haystack.includes("netflix"))
        return siNetflix;
    if (haystack.includes("twitch"))
        return siTwitch;
    if (haystack.includes("tiktok"))
        return siTiktok;
    if (haystack.includes("instagram"))
        return siInstagram;
    if (haystack.includes("reddit"))
        return siReddit;
    if (haystack.includes("x ") || haystack.includes("twitter"))
        return siX;
    if (haystack.includes("bluesky"))
        return siBluesky;
    if (haystack.includes("slack"))
        return siDiscord;
    if (haystack.includes("zoom"))
        return siZoom;
    if (haystack.includes("meet"))
        return siGooglemeet;
    if (haystack.includes("telegram"))
        return siTelegram;
    if (haystack.includes("whatsapp"))
        return siWhatsapp;
    if (haystack.includes("messenger"))
        return siMessenger;
    if (haystack.includes("signal"))
        return siSignal;
    if (haystack.includes("discord"))
        return siDiscord;
    if (haystack.includes("steam"))
        return siSteam;
    if (haystack.includes("epic"))
        return siEpicgames;
    if (haystack.includes("battle.net") || haystack.includes("battlenet"))
        return siBattledotnet;
    if (haystack.includes("playstation") || haystack.includes("ps5"))
        return siPlaystation;
    if (haystack.includes("github"))
        return siGithub;
    if (haystack.includes("figma"))
        return siFigma;
    if (haystack.includes("notion"))
        return siNotion;
    if (haystack.includes("dropbox"))
        return siDropbox;
    if (haystack.includes("drive"))
        return siGoogledrive;
    if (haystack.includes("adobe"))
        return siFigma;
    if (haystack.includes("paypal"))
        return siPaypal;
    if (haystack.includes("microsoft"))
        return siVscodium;
    if (haystack.includes("linkedin"))
        return siGithub;
    if (haystack.includes("amazon"))
        return siGooglechrome;
    if (haystack.includes("chrome"))
        return siGooglechrome;
    if (haystack.includes("firefox"))
        return siFirefox;
    if (haystack.includes("safari"))
        return siSafari;
    if (haystack.includes("opera"))
        return siOpera;
    if (haystack.includes("obsidian"))
        return siObsidian;
    if (haystack.includes("tidal"))
        return siTidal;
    if (haystack.includes("cursor"))
        return siCursor;
    if (haystack.includes("code") || haystack.includes("vscode"))
        return siVscodium;
    if (haystack.includes("gmail") || haystack.includes("mail"))
        return siGmail;
    return undefined;
}
