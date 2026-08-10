import { mount } from "svelte";
import App from "./App.svelte";
import "./ui/theme.css";

const target = document.getElementById("app");
if (target === null) throw new Error("Missing #app mount point");

export default mount(App, { target });
