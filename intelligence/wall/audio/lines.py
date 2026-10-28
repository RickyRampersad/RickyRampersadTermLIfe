"""What the wall says — every screen's narration, in one place.

The voice is the branch's: en-US-AndrewNeural at -12%, the same read as the
films (see CLAUDE.md, "The voice"). NOT the Multilingual variant — it detects
language from the text and read a phrase in another one on the first cut.

WHY NO NUMBERS ARE SPOKEN. Every figure on these screens changes on the next
nightly rebuild and the audio does not. A voice that said "forty one policies"
would be confidently wrong within a day, over a screen showing the right
figure. So the screen carries the arithmetic and the voice carries the
meaning, and nothing below stops being true when the data moves.

Short declarative sentences. State the fact and trust it. If a line needs to
breathe more, split it in two rather than reaching for a comma."""

VOICE = 'en-US-AndrewNeural'
RATE = '-12%'

# Keyed by page: audio/narration/<key>/lineNN.mp3 folds into ../<key>.html.
WALLS = {
    'day': [                                     # The Day So Far
        "This is the branch's own day.",
        "Every other screen on this wall is about the client book. This one is about us.",
        "The big number is what the branch has closed today.",
        "Beside each desk, what is still open, what is late, and what has gone quiet.",
        "Quiet means nobody has touched it in a week. A task with a date next month and no movement is not in hand.",
        "On the right, how much of the list the system set at check-in is done.",
        "No client is named here. Counts only.",
    ],
    'blocks': [                                  # The Day, Hour by Hour (28 Oct 2026, 28d; was The System's Day)
        "This is the branch's day, hour by hour, from Salesforce.",
        "Along the top are the time blocks: what was closed in each hour, by task type, and under it what was worked on and not yet closed.",
        "The gold line is where the clock is now.",
        "The top then turns to each desk's ring: what they have closed against their day, and the white mark where the clock is.",
        "Below, each desk across the same hours, with what they closed, what they worked on, and how old that work is.",
        "The last row is the Branch Manager: the birthday e-mails and the notes that run as him, kept apart from the desks' totals.",
        "Then the agents served today. Each bubble is the work done for one agent, and its ring is how much of it was closed. Nobody is ranked, and no client is named here.",
    ],
    'riders': [                                  # Riders On A Clock
        "Every rider has an expiry.",
        "The policy can run for life. The critical illness riding on it stops on a date.",
        "That is the gold figure. Rider cover sitting on policies that never end.",
        "Most of those clients have not been told, because nobody has had the date in front of them.",
        "The strip is this month, day by day. Gold is a date still to come. Grey has gone.",
        "Under it, each day says which rider ends, so the call opens with the right words.",
        "The amber tile is the work that cannot wait. Riders whose date has passed on a policy that is still paying.",
        "Either the client is paying for cover that is not there, or we are showing cover that is not there.",
        "Both of those are a phone call.",
        "The second tile is the blind spot. Most riders on this book carry no end date at all.",
        "Nobody can ring a client about a date that was never written down, so the screen says how many.",
        "The table is the four riders. Critical illness, accidental death, waiver of premium, disability income.",
        "Every row is in force, and tested against the branch's own dues tab.",
        "No client is named here. Cover and counts only.",
    ],
    'conversion': [                              # Conversions This Month
        "Only one kind of policy on this book is allowed to become something else.",
        "Flexi Term, with a C in the code. Nothing else on the branch's book has ever converted.",
        "Convertible means permanent cover with no medical, no questions, and no chance of being declined.",
        "It is worth the most to the client least likely to pass a medical.",
        "But it has to be in force, and it has to be paid up.",
        "A lapsed policy cannot be converted at all. One in arrears cannot be converted until somebody collects.",
        "So the gold column is the call that comes first. Collect, then convert.",
        "Conversion is priced at the age the client has reached.",
        "So the cheapest day to do it is the day before a birthday, and the dearest is the day after.",
        "That is why this list is the month's birthdays, and why the gold figure is the half still to come.",
        "The strip is this month, day by day. Gold is a birthday still to come. Grey is one that has gone.",
        "The list is ordered by whose birthday is soonest, because that is the order to ring them in.",
        "Beside each agent is the day, and the age their client turns on it. Say both on the call.",
        "The last panel is term written non-convertible. Nothing to exchange, so it is a fresh application, before the date.",
        "Econo Life and Liberator are not on this screen. Nothing about them ends on a date, and they have a screen of their own.",
        "No client is named here. Cover and counts only.",
    ],
    'pending': [                                 # Branch Pending · Policies (rebuilt 27 Oct 2026, 27h)
        "This is the branch pending wall, policy by policy, from today's pending report.",
        "The big number is every policy that still has something outstanding.",
        "The bar under it is where underwriting has them. Approved ones need only the last items in, so they come first.",
        "One item from issue, ready with only the premium left, and money already paid that we cannot apply yet.",
        "On the right, every agent, and what is on their desk. Documents, medicals and first premiums.",
        "Then the Salesforce tasks on those same policies. Open, overdue, untouched for a week, and done today.",
        "The last column is the one to fix: policies nobody has ever raised a task on. No client is named here.",
    ],
    'increases': [                            # Increases, group & health (rebuilt 28 Oct 2026, 28b)
        "This slide is the pendings Guardian's report cannot see: increases, group life, group health and individual health.",
        "On the left, increases on policies already in force, and the premium waiting on them.",
        "In the middle, the group and health book. Gold is pending, green is paying, and grey has no status in Salesforce at all.",
        "On the right, every case actually pending, whose it is, and how long it has waited.",
        "Underneath, the records over a year old still marked pending. Those are not work. Close them in Salesforce.",
        "It reads Salesforce every hour. No client is named here.",
    ],
    'reqs': [                                    # Branch Pending · what is outstanding, and who is chasing it (27 Oct 2026)
        "This is what is still outstanding on our pending cases, from today's pending report.",
        "The big number is every requirement still waiting to be received.",
        "The bars are the agents who still owe a first premium. Collect it, and the policy can issue.",
        "Most requirements sit with the agent. That is the first call to make.",
        "On the right, what the team chased today, and which agents they chased.",
        "No client is named here. Counts and agents only.",
    ],
    'codes': [                                # Code by code (rebuilt 28 Oct 2026, 28b)
        "This is code by code: every requirement outstanding on today's pending report.",
        "On the left, whose move it is. Most sit with the agent, and that is the first call.",
        "The rest wait on the client, the doctor or the lab, and each line says what moves it.",
        "On the right, each requirement: how many are out, how many Guardian marks overdue, and how many came in this week.",
        "Under each, the agents holding it. Orphans are the cases still to be reassigned.",
        "The pages turn on their own, so every code is on the wall. No client is named here.",
    ],
    'issued': [                               # Issued this month, by unit and agent (28 Oct 2026, 28b)
        "This is what the branch has issued this month, from Guardian's production report.",
        "The big number is every policy settled since the first, and the annual premium on them.",
        "The bar is a usual month for the people here now. The mark on it is where a usual month would be by today.",
        "Under it, week by week, and where we were on this same day last month.",
        "On the right, each unit, then each agent in name order. Nobody is ranked here.",
        "Each bar is that person against their own usual month, and green is past it. No client is named here.",
    ],
    'orphans': [                              # The orphan campaign (28 Oct 2026)
        "This is the orphan campaign: the clients whose agents left, and where we stand with every one of them.",
        "On the left, every household on our books, how many answered the letter, and how many asked us for something.",
        "The bar shows how far those households have got: completed, an agent named, spoken to, or still waiting on us.",
        "On the right, today's lists. Each morning every desk gets a list, and each client on it is marked done, reached, tried, or nothing yet.",
        "Beside each list are the open tasks that person holds, and how many are past their date.",
        "Below, the clients named to an agent in Salesforce, agent by agent. No client is named on this screen.",
    ],
    'orphans-results': [               # What the orphan campaign has earned (28 Oct 2026)
        "This is what the orphan campaign has earned so far.",
        "On the left, the two hundred dollars an agent earns for every service questionnaire: paid, to be paid on the next commission run, and still on its way.",
        "Each claim moves through Customer Service and then Retention, and the stages show where every one of them is.",
        "On the right, the new applications from orphan clients, and the premiums paid back since our letters.",
        "We also count every lapsed policy that is now back in force.",
        "Below, what clients are telling us, by subject. No client is named on this screen.",
    ],
    'orphans-cup': [                   # The First-Contact Cup (28 Oct 2026)
        "This is the First-Contact Cup, for Client Support.",
        "Every client of the campaign is a race to the first conversation, and then to the service questionnaire.",
        "Three points for every client you reach first, two more within two working days, and ten for the questionnaire it brings home.",
        "The AI reads every timeline and rates how clearly you communicate, and how firmly you bring it home.",
        "Last week's champion is celebrated at the Wednesday meeting.",
        "Below, who looks after whom: each agent, the support person beside them, and the questionnaires they have brought in.",
    ],
    'orphans-driver': [                # The Branch Manager's drive (28 Oct 2026)
        "This is the Branch Manager's drive on the orphan campaign.",
        "Every prompt he puts on the tasks is counted, in his own words and from the automation he set going.",
        "His automation writes to clients, briefs the agents, and alerts the branch. Every one is counted here.",
        "This ring shows when the team answers his prompts: the same day, the next working day, or later.",
        "Day by day, his prompts stand beside the team's notes.",
        "And for each member of the team: how many notes came after a prompt, and what those notes say.",
    ],
    'index': [                                   # The 45-Day Line
        "This is the forty five day line.",
        "Past the grace period. Still early enough that a phone call works.",
        "The number on the left is today's.",
        "Most of them were on a standing instruction that failed.",
        "A bank order. A salary deduction. Something that should have collected itself.",
        "That is a bank to ring. Not a client who refused.",
        "And most have been in force for years, not months.",
        "These are not bad sales. They are long standing clients who stopped.",
        "The gold bar is a whole billing cohort crossing on one day.",
        "Work it before it lands.",
    ],
    'lapses': [                                  # Lapses On A Calendar
        "This is what the book lost.",
        "The dues line is policies still alive. This screen is what has already gone.",
        "The three numbers are this month, the quarter, and the year so far.",
        "The strip is the year, month by month. The tallest bar is the month that took the most.",
        "Beside it, how long each policy had lived before it lapsed. Issue date to lapse date.",
        "A policy that lapses in its first year was never really placed. One that lapses after many years is a client who stopped.",
        "Underneath, who held them. The agent on the record, and the premium that went with it.",
        "No client is named. Counts and premium only.",
    ],
    'possession': [                              # Whose Hands Is It In
        "This is whose hands it is in.",
        "A contract comes from head office to our cabinet. Then to the agent. Then to the client, who signs for it.",
        "The big number is the ones with an agent, still unsigned.",
        "The days count from the moment it left our cabinet.",
        "Past ninety days is not a delay. It is a policy the client has never held.",
        "Below that, the ones still in the cabinet. Nobody has collected them. That part is ours.",
        "Two halves of one job, measured separately. So the delay has a name.",
    ],
    'delivery': [                                # Contract Delivery
        "This is contract delivery.",
        "Every contract head office has dispatched to us, and how long it has sat here.",
        "The number on the left is the ones in the cabinet now.",
        "Beside it, how many are past our own standard. Not head office's. Ours.",
        "By unit, whose clients are waiting, and the oldest in each.",
        "By plan, what kind of contract is sitting here.",
        "A contract in a cabinet is a client who has paid and holds nothing.",
        "Deliver it. That is the whole instruction.",
    ],
    'licence': [                                 # Licensing Year
        "This is the licensing year.",
        "Every licence the branch holds, by the month it renews.",
        "Life and general are two licences, on two anniversaries. An agent can be current on one and lapsed on the other.",
        "The number on the left renews this month. Beside it, the next forty five days.",
        "A first renewal is a form nobody has filled in before. Those are the ones to walk through.",
        "The Act is plain. Nobody sells while they are not registered.",
        "A date on this wall that goes by is business the branch cannot lawfully write.",
        "Start the month before. Not the week of.",
    ],
    'book': [                                    # Birthdays Today
        "These are today's birthdays.",
        "The email has already gone. First thing this morning, in your name.",
        "It has gone every year for years. What it has never done is ask a question.",
        "The bands are where each client is in life. And what that stage is usually short of.",
        "A birthday is the one day a client expects to hear from you. Use it to ask.",
        "The gold marks a gap in cover. That is the conversation the call is for.",
        "Below, the month so far. And what came back.",
        "No names on this wall. You have them in your portal. Call.",
    ],
}


def mp3_seconds(path):
    """Duration by counting MPEG frames — no ffprobe, no dependency.

    The bed under the narration is told how long to last so it lands on its
    home chord instead of being cut off, and it can only know that if these
    durations travel with the audio."""
    d = path.read_bytes(); i = 0; n = len(d); t = 0.0
    BR = {1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
          0: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]}
    SR = {3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000]}
    if d[:3] == b'ID3':
        i = 10 + ((d[6]&0x7f)<<21 | (d[7]&0x7f)<<14 | (d[8]&0x7f)<<7 | (d[9]&0x7f))
    while i + 4 <= n:
        if d[i] != 0xFF or (d[i+1] & 0xE0) != 0xE0: i += 1; continue
        ver = (d[i+1]>>3)&3; layer = (d[i+1]>>1)&3
        if layer != 1: i += 1; continue                       # Layer III only
        bi = (d[i+2]>>4)&0xF; si = (d[i+2]>>2)&3; pad = (d[i+2]>>1)&1
        if bi in (0,15) or si == 3: i += 1; continue
        mpeg1 = ver == 3
        br = BR[1 if mpeg1 else 0][bi]*1000; sr = SR.get(ver, SR[2])[si]
        if not br or not sr: i += 1; continue
        spf = 1152 if mpeg1 else 576
        flen = int(spf/8*br/sr) + pad
        if flen <= 0: i += 1; continue
        t += spf/sr; i += flen
    return round(t, 2)
