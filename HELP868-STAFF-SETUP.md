# HELP 868 for staff: simple setup (no code)

The client page is `rickyrampersadbranch.com/help868/`. Each button opens WhatsApp to the HELP 868 number with the
request already typed (QUERY, CLAIM, UPDATE, PAYMENT, QUOTE, PENDING, OTHER). To change the number, edit
`HELP868_NUMBER` in that page, once. The Apps Script look-ups (`Help868.gs`) are not needed for this and stay off.

## 1. Add staff in respond.io (about 5 minutes)
Settings → Users → Invite. Role **Agent** for Sasha, Liz and Azariah (their branch e-mails); Kamla as **Manager**.
Each person accepts the invite and installs the respond.io app on their phone.

## 2. One team
Settings → Teams → New team "Client Support": add the three staff. Kamla and the owner are managers over it.

## 3. Notifications (per person)
Profile → Notifications: turn on **new conversation assigned to me**, **new message in my conversations** and
**mentions**, on phone push and e-mail. Turn on **unassigned conversations** for the team.

## 4. Routing (Workflows → New → trigger "Conversation opened")
1. Add tag by first word of the message: QUERY, CLAIM, UPDATE, PAYMENT, QUOTE, PENDING, OTHER.
2. Assign to team "Client Support", round robin.
3. Send the auto-reply below; outside 8:00am to 4:00pm Monday to Friday send the after-hours one instead.
4. If still unanswered after 30 minutes, assign to the owner and notify.

## 5. Auto-replies
- Hours: "Thanks for contacting Ricky Rampersad Branch. A member of our team will reply shortly. Please don't send bank or card details, ID numbers or health information here."
- After hours: "Thanks, we've got your message and will reply first thing on our next working day. For an urgent claim, call (868) 678-5921."
- QUOTE: "Thanks! To start your quote, please tell us: your full name and what you'd like covered (motor, life, pension, home). We'll take it from there."
- CLAIM: "Sorry to hear that. Please tell us your name and policy number, and briefly what happened. A team member will follow up."

## 6. Quick replies for staff (Settings → Snippets)
"Please send your policy number" · "We're checking on it and will update you today" · "Please call us on (868) 678-5921" · "Your update has been made, thank you".

## What this cannot do
Staff are not licensed to advise: anything about cover, a claim decision or a quote price goes to a licensed agent.
