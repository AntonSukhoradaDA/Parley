import { LegalPage } from './LegalPage'

export function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of Use" lastUpdated="2026-04-18">
      <Intro>
        These Terms of Use govern your access to and use of Parley. By registering for or using
        Parley, you agree to be bound by these Terms. If you do not agree, do not use the service.
      </Intro>

      <H2>Your account</H2>
      <Ul>
        <Li>
          You must provide accurate registration information and keep your password confidential.
        </Li>
        <Li>You are responsible for all activity under your account.</Li>
        <Li>Your username is unique and cannot be changed after registration.</Li>
        <Li>One person, one account. Do not share credentials.</Li>
      </Ul>

      <H2>Acceptable use</H2>
      <P>You agree not to use Parley to:</P>
      <Ul>
        <Li>Post unlawful, harassing, hateful, or sexually explicit content.</Li>
        <Li>Impersonate another person or misrepresent your affiliation.</Li>
        <Li>Distribute malware, phishing content, or spam.</Li>
        <Li>
          Attempt to disrupt, reverse-engineer, or exceed the intended capacity of the service.
        </Li>
        <Li>Upload files that infringe the intellectual property rights of others.</Li>
      </Ul>
      <P>
        Room owners and admins may remove or ban members who violate these rules or the rules of
        their specific room.
      </P>

      <H2>Your content</H2>
      <P>
        You retain ownership of the messages and files you post. By posting content to Parley you
        grant us a limited, non-exclusive license to store, transmit, and display that content
        solely to operate the service for you and the other participants you address.
      </P>
      <P>
        You are solely responsible for the content you post. We do not pre-screen content and do not
        endorse any opinions expressed by users.
      </P>

      <H2>Moderation</H2>
      <Ul>
        <Li>
          Admins of a room may delete messages, remove or ban members, and manage room settings.
        </Li>
        <Li>
          Users may ban each other at the account level; personal-message history between banned
          parties becomes read-only.
        </Li>
        <Li>We reserve the right to suspend or terminate accounts that violate these Terms.</Li>
      </Ul>

      <H2>Service changes and availability</H2>
      <P>
        We may modify, suspend, or discontinue any part of Parley at any time. We do not guarantee
        uninterrupted availability. Scheduled maintenance and incidents may cause temporary
        unavailability.
      </P>

      <H2>Termination</H2>
      <P>
        You may delete your account at any time from the Profile → Delete account screen. We may
        terminate or suspend your account for violation of these Terms, misuse of the service, or by
        legal requirement. Upon termination, rooms you own will be deleted along with their messages
        and files.
      </P>

      <H2>Disclaimers</H2>
      <P>
        Parley is provided "as is" without warranties of any kind, express or implied, including
        fitness for a particular purpose or non-infringement. Use of the service is at your own
        risk.
      </P>

      <H2>Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, Parley and its operators are not liable for
        indirect, incidental, special, consequential, or punitive damages arising out of or related
        to your use of the service.
      </P>

      <H2>Governing law</H2>
      <P>
        These Terms are governed by the laws of the jurisdiction in which the service operator is
        established, without regard to its conflict-of-laws provisions.
      </P>

      <H2>Changes</H2>
      <P>
        We may update these Terms from time to time. Material changes will be communicated through
        the service; continued use after a change constitutes acceptance of the new Terms.
      </P>

      <H2>Contact</H2>
      <P>
        Questions about these Terms? Write to <code>legal@parley.example</code>.
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
