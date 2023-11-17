const express = require("express");
const sgMail = require('@sendgrid/mail');

const contactRouter = new express.Router()

contactRouter.post('/contact/new/message', async (req, res) => {
    try{
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        const msg = {
            to: 'technosys.sidd@gmail.com',
            from: 'admin@meetzflow.com',
            reply_to: req.body.email,
            subject: `New Message On MeetzFlow from ${req.body.name}`,
            text: req.body.message,
            html: `<p>${req.body.message}</p>`
        };
        sgMail.send(msg);
        res.status(201).send("Message Sent Successfully!")
    } catch (error) {
        res.status(500).send("Server Error!")
    }
})

module.exports = contactRouter