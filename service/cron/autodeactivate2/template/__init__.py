def emailtemplate():
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Baby, come back!</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif;">
        <table width="100%" cellspacing="0" cellpadding="0" border="0" align="center">
            <tr>
                <td align="center">
                    <table width="600" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                            <td bgcolor="#70f" align="center">
                                <img src="https://email-assets.duolicious.app/header-logo.png" alt="Duolicious Logo" width="108" height="50" />
                            </td>
                        </tr>
                        <tr>
                            <td bgcolor="#f1e5ff" height="20">&nbsp;</td>
                        </tr>
                        <tr>
                            <td bgcolor="#f1e5ff" align="center" style="color: #70f; padding-left: 20px; padding-right: 20px; padding-bottom: 20px;">
                                <p style="color: #70f; font-size: 20px; font-weight: 900;">Baby, come back!</p>
                                <p style="color: #70f; font-size: 16px">
                                  Because we only show active members, your profile was hidden for now. That means you won't get any more intros or chats until you get on Duolicious.
                                </p>
                            </td>
                        </tr>
                        <tr>
                          <td bgcolor="#f1e5ff" align="center" style="padding-bottom:25px">
                            <table border="0" cellspacing="0" cellpadding="0">
                              <tbody><tr>
                                <td style="border-radius:50px; border:3px solid #70f; font-size: 16px; line-height:26px; color: #70f; text-align:center; min-width:auto!important">
                                  <a href="https://web.duolicious.app/" style="display:block;padding:11px 40px;text-decoration:none;color:#70f" target="_blank">
                                    <span style="text-decoration:none;color:#70f">
                                      <strong>
                                        Get on Duolicious
                                      </strong>
                                    </span>
                                  </a>
                                </td>
                              </tr>
                            </tbody></table>
                          </td>
                        </tr>
                        <tr>
                            <td bgcolor="#f1e5ff" height="20">&nbsp;</td>
                        </tr>
                        <tr>
                            <td bgcolor="#70f" height="50">&nbsp;</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
