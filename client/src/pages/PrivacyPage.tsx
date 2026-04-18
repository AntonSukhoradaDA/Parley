import { LegalPage } from './LegalPage'

export function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" lastUpdated="2026-04-18">
      <Intro>
        This Privacy Policy explains what information Parley collects when you use the service, how
        we use it, and the choices you have. By using Parley you agree to the practices described
        here.
      </Intro>

      <H2>Information we collect</H2>
      <P>
        When you create an account we collect your email address, your chosen username, and a
        password (stored only as a one-way hash). While you use Parley we store:
      </P>
      <Ul>
        <Li>Messages you send, including replies, edits, and deletion events.</Li>
        <Li>
          Files and images you attach, with their original filenames and any comments you add.
        </Li>
        <Li>Room membership, roles, invitations, and moderation actions.</Li>
        <Li>
          Session metadata - IP address, user agent, and timestamps - used to populate the Active
          Sessions screen and to detect abuse.
        </Li>
        <Li>Presence state (online / AFK / offline) derived from your tab activity.</Li>
      </Ul>

      <H2>How we use it</H2>
      <Ul>
        <Li>
          To operate the service: route messages, authenticate sessions, enforce access control, and
          deliver attachments.
        </Li>
        <Li>
          To maintain safety: investigate abuse reports and apply bans or removals under Parley's
          Terms of Use.
        </Li>
        <Li>To communicate with you about security-relevant events, such as password resets.</Li>
      </Ul>
      <P>We do not sell your data. We do not use your messages to train third- party models.</P>

      <H2>Retention</H2>
      <P>
        Messages and attachments persist as long as the room they belong to exists. Deleting a room
        permanently removes all of its messages and files. Deleting your account removes your user
        record and any rooms you own (with all of their contents); your membership in other rooms is
        removed.
      </P>

      <H2>Sharing</H2>
      <P>
        Content you post in a chat room is visible to other members of that room. Personal messages
        are visible only to the two participants. Administrators of a room can see the room's
        moderation metadata (who banned whom, and when).
      </P>
      <P>
        We do not share your personal information with third parties except where required by law or
        to protect the integrity of the service.
      </P>

      <H2>Your rights</H2>
      <Ul>
        <Li>You can change your password at any time from the Profile menu.</Li>
        <Li>You can terminate individual sessions from the Sessions screen.</Li>
        <Li>You can delete your account from the Profile → Delete account screen.</Li>
      </Ul>

      <H2>Security</H2>
      <P>
        Passwords are stored only as bcrypt hashes. Session tokens are signed JWTs with short
        expirations. Files are served only to members of the originating room. Despite reasonable
        care, no online service is perfectly secure, and you use Parley at your own risk.
      </P>

      <H2>Changes</H2>
      <P>
        We may update this Privacy Policy from time to time. Material changes will be communicated
        through the service; continued use after a change constitutes acceptance of the new policy.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about privacy? Write to <code>privacy@parley.example</code>.
      </P>
    </LegalPage>
  )
}

function Intro({ children }: { children: React.ReactNode }) {
  return <p className="text-chalk/80 text-base leading-relaxed mb-8">{children}</p>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-paper text-xl font-medium tracking-tight mt-10 mb-3">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-bone/90 text-[15px] leading-relaxed mb-4">{children}</p>
}
function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-5 text-bone/90 text-[15px] leading-relaxed mb-4 space-y-1.5 marker:text-mist">
      {children}
    </ul>
  )
}
function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}
