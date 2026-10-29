#!/usr/bin/env bash
# Andrew's lines for Wall Intelligence (20 October 2026), one file per scene, into this folder.
# Made on the GitHub runner (branch tts-run, tts/job.json key "wall"); this script does the same on any computer with edge-tts.
# The voice: Andrew Multilingual ("Andrew Expressive"), at natural pace, in conversational wording. Mr Rampersad chose it
# on 21 October 2026 from five samples after hearing en-US-AndrewNeural at -4% as robotic. It can slip into another
# language on an unusual word, so every clip is transcribed on the runner (tts.yml, "check") and its language checked
# before it is used. The wall's captions (each scene's rec line) are these words.
set -euo pipefail
cd "$(dirname "$0")"
V=en-US-AndrewMultilingualNeural; R=+0%
say() { edge-tts --voice "$V" --rate="$R" --text "$2" --write-media "$1.mp3"; echo "  $1.mp3"; }
say n0 "Welcome to the Ricky Rampersad Branch, live. Here's how the day's going, for our staff, our agents and our managers."
say n1 "Let's start with the staff. Who's in, who's out today, and who's covering, so no client is kept waiting."
say n2 "Hour by hour, here's what's getting done. The colours show the kind of task, and the gold square is the bag."
say n3 "Here's where the work went. The high-payoff work comes first: new business, orphan adoption and retention."
say n4 "Now the team game. Everybody plays, and nobody's ranked. Each person plays against their own usual week."
say n10 "How did we serve? Every task we close for an agent or a client gets rated, by the people we serve."
say n11 "Shout-outs! Today's wins. Par reached, five-star service, new levels, streaks, and every single thank-you."
say n5 "Now, over to the agents. Their day in the field, and the fact finds that turn into cover."
say n6 "From a fact find to a family covered. Here's the month, and the year's goal against the time gone."
say n9 "The Branch Manager's day. Everything done from his desk since five this morning, as it happens."
say n7 "And the managers. Leading the branch, Akaash's unit out in the field, and every desk covered."
say n8 "And that's what's happening right now, live, across the whole branch."
# Channel 5, FY27: our new way of work (21 Oct 2026; runner key "fy27").
say w1 "It's a new financial year, and we've got a new way of working. Let me show you what's changed."
say w2 "One app, and one sign-in. Every tool we use, from the Log Book to the forms, lives at rickyrampersadbranch dot com, slash app."
say w3 "So, who does what, every day? The Branch Manager, the Unit Manager, the BMA, Sales Support and our agents. Each one has a rhythm."
say w4 "And every week has its beat. Premium letters every morning, group letters on Monday, and on Wednesday, our branch meeting, where we celebrate the week's wins."
say w5 "This is Branch Intelligence. It reads a task's whole history, tells you where it stands, and drafts the reply. The managers and the BMA check it and post it, and Sales Support get the day's coach."
say w6 "And here's the game for the new year. Par, three quests a day, streaks and levels, and one team goal: get the backlog down by Friday."
say w7 "The Branch Manager, the Unit Manager, the BMA, Sales Support, and every one of our agents. One branch. Thank you, team. Here's to our new financial year!"
say w8 "Here's how the papers move, end to end. The agent logs them, Sales Support signs for them, they're in by noon, and they go out on a transmittal."
say w9 "Shared work. When someone's out, their work moves to whoever's in, within thirty minutes, at each person's own pace. So no client waits."
say w11 "So what does each manager see? The Branch Manager, the Unit Manager and the BMA each open one page in the morning, and they can comment under any task, with Branch Intelligence drafting it."
say w10 "Fact find insights. Every conversation goes on a fact find, and we read them every single day: the fact finds, the applications, and the year's goals."
say w12 "Our walls are live in the branch. Everyone sees the score, all day, and every win. That's how we build a high-performance branch."
say w13 "Here's what's different about our meetings now. Everyone signs in on their phone, and that's the register. You add your item to the agenda, you say what you're presenting, and every slot has a name on it. So every voice gets heard."
say w14 "And the client feels it. Queries answered on time, every handover recorded, and the people we serve rating us."
say w15 "And inside the meeting, it's all there. Your item's ready, the actions from last week come back, and the minutes are written as we go."
say w17 "And the transmittal? It's built for you now. Staff receive the papers on the phone, press one button, and out it comes, numbered, stamped and ready to print. Three days later, the department confirms it all arrived."
say w16 "Let's watch it work. One tap, and it reads everything on the task, says where things stand, and writes the reply in your voice. Want it firmer, shorter, or kinder? One more tap. And nothing posts until you say so."
say w18 "Nothing slips through. When a client says yes, the system follows it every day until it closes. A fact find started and never sent gets flagged on Monday. And the managers see every answer."
say w19 "And here's the production wall. Every policy picked up, this week, this month and this year, and the money already written and waiting to come in."
say w20 "And our goals are aligned. Each agent builds their goal from their own numbers, all the way down to fact finds a week. Those add up to the unit, the unit adds up to the branch, and the pace is checked every single morning."
say w21 "Every Wednesday at the meeting, we celebrate the week's wins. Agents and staff, side by side. There's a Starbucks ticket, Movie Town tickets, and everyone gets acknowledged."
say w22 "For our clients, it's one journey, and we're there at every touch point. From the first fact find to the policy in their hands, and every year after. And our agents never walk it alone."
say w23 "And all of it is built to the Central Bank's market conduct rules, under the Insurance Act. Needs first, advice in writing, policies delivered on time, and every complaint answered."
say w24 "Here's the digital fact find, end to end. Needs first, then the client's plan in writing, checked by a manager within a day, confirmed by the client, and followed every morning until it closes. And the result? Since we launched it in August, not a single lapse."
say w26 "Now the papers. The agent logs them on the phone, in the Log Book. Type a client's name and it all pulls up: their policy, the right department, and what usually goes with it, from years of our own clean data. The clock shows which bag it catches, and the agent sees every stamp."
say w25 "And every step has its letter. The client gets their plan in plain words, the manager gets the sign-off, the agent gets their copy, and the client signs and rates the agent. Nothing is left to memory."
echo "Done. Commit the 38 wall/audio/v2/*.mp3 files and the wall uses them."
