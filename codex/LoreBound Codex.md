# LoreBound Codex

> **Authoritative Project Specification**
>
> This document defines the vision, architecture, terminology, engineering standards, UI principles, and roadmap for LoreBound.
## Table of Contents

- [Volume I](#volume-i)
  - [Chapter 1](#chapter-1)
    - [1.1 Purpose](#11-purpose)
    - [1.2 Mission Statement](#12-mission-statement)
    - [1.3 Vision Statement](#13-vision-statement)
    - [1.4 What LoreBound Is](#14-what-lorebound-is)
    - [1.5 What LoreBound Is Not](#15-what-lorebound-is-not)
    - [1.6 Product Philosophy](#16-product-philosophy)
    - [1.7 Design Goal](#17-design-goal)
  - [Chapter 2](#chapter-2)
    - [2.1 Brand Name](#21-brand-name)
    - [2.2 Ofﬁcial Tagline](#22-ofcial-tagline)
    - [2.3 Logo](#23-logo)
    - [2.4 Brand Personality](#24-brand-personality)
    - [2.5 Brand Voice](#25-brand-voice)
    - [2.6 Ofﬁcial Vocabulary](#26-ofcial-vocabulary)
    - [2.7 Visual Identity Philosophy](#27-visual-identity-philosophy)
    - [2.8 Interactive Workspace Philosophy](#28-interactive-workspace-philosophy)
    - [2.9 Identity Statement](#29-identity-statement)
    - [2.10 Ofﬁcial Brand Palette](#210-ofcial-brand-palette)
  - [Chapter 3](#chapter-3)
    - [3.1 Introduction](#31-introduction)
    - [3.2 User Journey](#32-user-journey)
    - [3.3 The Case Archive](#33-the-case-archive)
    - [3.4 Creating a Case](#34-creating-a-case)
    - [3.5 The Workspace](#35-the-workspace)
    - [3.6 Sidebar Navigation](#36-sidebar-navigation)
    - [3.7 Investigative Lenses](#37-investigative-lenses)
    - [3.8 Investigation Flow](#38-investigation-flow)
    - [3.9 Progressive Investigation](#39-progressive-investigation)
    - [3.10 Universal Navigation](#310-universal-navigation)
    - [3.11 The LoreBound Experience](#311-the-lorebound-experience)
  - [Chapter 4](#chapter-4)
    - [4.1 Introduction](#41-introduction)
    - [4.2 The Prime Directive](#42-the-prime-directive)
    - [4.3 The Investigator Principle](#43-the-investigator-principle)
    - [4.4 One Investigation. Many Ways to Explore](#44-one-investigation-many-ways-to-explore)
    - [4.5 Single Source of Truth](#45-single-source-of-truth)
    - [4.6 Progressive Detail](#46-progressive-detail)
    - [4.7 Assistance Without Control](#47-assistance-without-control)
    - [4.8 Atmosphere Enhances Usability](#48-atmosphere-enhances-usability)
    - [4.9 User Ownership](#49-user-ownership)
    - [4.10 Simplicity Before Complexity](#410-simplicity-before-complexity)
    - [4.11 The Apple Test](#411-the-apple-test)
    - [4.12 Consistency Builds Trust](#412-consistency-builds-trust)
    - [4.13 Respect the User's Time](#413-respect-the-users-time)
    - [4.14 The Long-Term Vision](#414-the-long-term-vision)
- [Volume II](#volume-ii)
  - [Chapter 5](#chapter-5)
    - [5.1 Purpose](#51-purpose)
    - [5.2 The Case Archive](#52-the-case-archive)
    - [5.3 Creating a Case](#53-creating-a-case)
    - [5.4 Universe Types](#54-universe-types)
    - [5.5 Case Philosophy](#55-case-philosophy)
    - [5.6 Case Organization](#56-case-organization)
    - [5.7 Case Metadata](#57-case-metadata)
    - [5.8 Case Settings](#58-case-settings)
    - [5.9 Case Independence](#59-case-independence)
    - [5.10 Progressive Growth](#510-progressive-growth)
    - [5.11 Future Collections](#511-future-collections)
    - [5.12 Case Lifecycle](#512-case-lifecycle)
  - [Chapter 6](#chapter-6)
    - [6.1 Purpose](#61-purpose)
    - [6.2 Philosophy](#62-philosophy)
    - [6.3 Visual Identity](#63-visual-identity)
    - [6.4 View Mode](#64-view-mode)
    - [6.5 Edit Mode](#65-edit-mode)
    - [6.6 Progressive Information Density](#66-progressive-information-density)
    - [6.7 Optional Images](#67-optional-images)
    - [6.8 Universal Sections](#68-universal-sections)
    - [6.9 Record-Speciﬁc Sections](#69-record-specic-sections)
    - [6.10 Navigation](#610-navigation)
    - [6.11 Timeline Integration](#611-timeline-integration)
    - [6.12 Information Ownership](#612-information-ownership)
    - [6.13 Reading Experience](#613-reading-experience)
    - [6.14 The Living Document](#614-the-living-document)
  - [Chapter 7](#chapter-7)
    - [7.1 Purpose](#71-purpose)
    - [7.2 Philosophy](#72-philosophy)
    - [7.3 Universal Bond Model](#73-universal-bond-model)
    - [7.4 Smart Bonds](#74-smart-bonds)
    - [7.5 Bond Categories](#75-bond-categories)
    - [7.6 Bond Navigation](#76-bond-navigation)
    - [7.7 Bond Evidence](#77-bond-evidence)
    - [7.8 Bond Status](#78-bond-status)
    - [7.9 Bond Intelligence](#79-bond-intelligence)
    - [7.10 Bonds Across Investigative Lenses](#710-bonds-across-investigative-lenses)
    - [7.11 Bond Visualization](#711-bond-visualization)
    - [7.12 Progressive Growth](#712-progressive-growth)
    - [7.13 Performance Philosophy](#713-performance-philosophy)
    - [7.14 The Living Knowledge Network](#714-the-living-knowledge-network)
  - [Chapter 8](#chapter-8)
    - [8.1 Purpose](#81-purpose)
    - [8.2 Philosophy](#82-philosophy)
    - [8.3 Board Modes](#83-board-modes)
    - [8.4 Board Independence](#84-board-independence)
    - [8.5 Smart Suggestions](#85-smart-suggestions)
    - [8.6 Board Navigation](#86-board-navigation)
    - [8.7 Board Clusters](#87-board-clusters)
    - [8.8 Board Views](#88-board-views)
    - [8.9 Visual Philosophy](#89-visual-philosophy)
    - [8.10 The Investigation Never Stops](#810-the-investigation-never-stops)
  - [Chapter 9](#chapter-9)
    - [9.1 Purpose](#91-purpose)
    - [9.2 Philosophy](#92-philosophy)
    - [9.3 Timeline Types](#93-timeline-types)
    - [9.4 Events Drive the Timeline](#94-events-drive-the-timeline)
    - [9.5 Explore Timeline](#95-explore-timeline)
    - [9.6 Chronology](#96-chronology)
    - [9.7 Timeline Filters](#97-timeline-filters)
    - [9.8 Timeline Navigation](#98-timeline-navigation)
    - [9.9 Living Timeline](#99-living-timeline)
    - [9.10 Timeline Integrity](#910-timeline-integrity)
    - [9.11 Timeline Philosophy](#911-timeline-philosophy)
    - [9.12 Future Expansion](#912-future-expansion)
  - [Chapter 10](#chapter-10)
    - [10.1 Purpose](#101-purpose)
    - [10.2 Philosophy](#102-philosophy)
    - [10.3 Universal Search](#103-universal-search)
    - [10.4 Access Methods](#104-access-methods)
    - [10.5 Search Results](#105-search-results)
    - [10.6 Context Awareness](#106-context-awareness)
    - [10.7 Recent Activity](#107-recent-activity)
    - [10.8 Intelligent Ranking](#108-intelligent-ranking)
    - [10.9 Search Philosophy](#109-search-philosophy)
    - [10.10 Search as an Investigative Lens](#1010-search-as-an-investigative-lens)
    - [10.11 Future Expansion](#1011-future-expansion)
  - [Chapter 11](#chapter-11)
    - [11.1 Purpose](#111-purpose)
    - [11.2 Design Philosophy](#112-design-philosophy)
    - [11.3 Universal Structure](#113-universal-structure)
    - [11.4 Character](#114-character)
    - [11.5 Location](#115-location)
    - [11.6 Event](#116-event)
    - [11.7 Organization](#117-organization)
    - [11.8 Theory](#118-theory)
    - [11.9 Knowledge Growth](#119-knowledge-growth)
    - [11.10 Evidence](#1110-evidence)
    - [11.11 Bonds](#1111-bonds)
    - [11.12 Extensibility](#1112-extensibility)
- [Volume III](#volume-iii)
  - [Chapter 12](#chapter-12)
    - [12.1 Purpose](#121-purpose)
    - [12.2 The Version 1 Goal](#122-the-version-1-goal)
    - [12.3 Core Features](#123-core-features)
    - [12.4 Version 1 Principles](#124-version-1-principles)
    - [12.5 Explicitly Excluded](#125-explicitly-excluded)
    - [12.6 Success Criteria](#126-success-criteria)
    - [12.7 The Discipline Rule](#127-the-discipline-rule)
  - [Chapter 13](#chapter-13)
    - [13.1 Purpose](#131-purpose)
    - [13.2 Roadmap Philosophy](#132-roadmap-philosophy)
    - [13.3 Planned Evolution](#133-planned-evolution)
    - [13.4 Ideas Parking Lot](#134-ideas-parking-lot)
    - [13.5 Feature Evaluation Framework](#135-feature-evaluation-framework)
    - [13.6 Revising the Roadmap](#136-revising-the-roadmap)
- [Volume IV](#volume-iv)
  - [Chapter 14](#chapter-14)
    - [14.1 Purpose](#141-purpose)
    - [14.2 The Codex Is the Source of Truth](#142-the-codex-is-the-source-of-truth)
    - [14.3 Readability Over Cleverness](#143-readability-over-cleverness)
    - [14.4 Modularity](#144-modularity)
    - [14.5 Extend Before Replace](#145-extend-before-replace)
    - [14.6 Performance Is a Feature](#146-performance-is-a-feature)
    - [14.7 Local-First](#147-local-first)
    - [14.8 Accessibility](#148-accessibility)
    - [14.9 Progressive Enhancement](#149-progressive-enhancement)
    - [14.10 Preserve the Interaction Language](#1410-preserve-the-interaction-language)
    - [14.11 Preserve the Five Pillars](#1411-preserve-the-five-pillars)
    - [14.12 Testing Philosophy](#1412-testing-philosophy)
    - [14.13 Documentation Philosophy](#1413-documentation-philosophy)
    - [14.14 Current Technical Stack (Version 1)](#1414-current-technical-stack-version-1)
  - [Chapter 15](#chapter-15)
    - [15.1 Purpose](#151-purpose)
    - [15.2 Development Philosophy](#152-development-philosophy)
    - [15.3 Milestone Structure](#153-milestone-structure)
    - [15.4 Branching Strategy](#154-branching-strategy)
    - [15.5 Commit Philosophy](#155-commit-philosophy)
    - [15.6 Documentation Workﬂow](#156-documentation-workow)
    - [15.7 AI-Assisted Development](#157-ai-assisted-development)
    - [15.8 Milestone Completion](#158-milestone-completion)
    - [15.9 Continuous Improvement](#159-continuous-improvement)
  - [Chapter 16](#chapter-16)
    - [16.1 Purpose](#161-purpose)
    - [16.2 Philosophy](#162-philosophy)
    - [16.3 Acceptance Criteria](#163-acceptance-criteria)
    - [16.4 Deﬁnition of Done](#164-denition-of-done)
    - [16.5 User Experience Review](#165-user-experience-review)
    - [16.6 Accessibility Review](#166-accessibility-review)
    - [16.7 Performance Review](#167-performance-review)
    - [16.8 Visual Review](#168-visual-review)
    - [16.9 Regression Review](#169-regression-review)
    - [16.10 Codex Compliance](#1610-codex-compliance)
      - [Design Locks](#design-locks)
    - [16.11 Release Readiness](#1611-release-readiness)
  - [Chapter 17](#chapter-17)
    - [17.1 Purpose](#171-purpose)
    - [17.2 The Codex Governs Development](#172-the-codex-governs-development)
    - [17.3 Preserve the Prime Directive](#173-preserve-the-prime-directive)
    - [17.4 Respect Existing Systems](#174-respect-existing-systems)
    - [17.5 Terminology Standards](#175-terminology-standards)
    - [17.6 User Experience First](#176-user-experience-first)
    - [17.7 AI Contribution Standards](#177-ai-contribution-standards)
    - [17.8 Design Lock Integrity](#178-design-lock-integrity)
      - [Design Locks exist to protect the identity of LoreBound.](#design-locks-exist-to-protect-the-identity-of-lorebound)
    - [17.9 Canon Status](#179-canon-status)
    - [17.10 The Stewardship Principle](#1710-the-stewardship-principle)
    - [17.11 Long-Term Thinking](#1711-long-term-thinking)
    - [17.12 Respect the User's Archive](#1712-respect-the-users-archive)
    - [17.13 Continuous Learning](#1713-continuous-learning)


# Volume I

## Chapter 1

Vision
"LoreBound should make every user feel like the lead investigator of their own ﬁctional
archive."

### 1.1 Purpose

LoreBound is a desktop-ﬁrst web application that empowers readers to investigate, organize, and
explore ﬁctional worlds through an interactive detective-inspired workspace.

Rather than functioning as a traditional wiki, note-taking application, or book catalog,
LoreBound transforms ﬁctional universes into living investigations where characters, locations,
events, organizations, and theories become interconnected through an intelligent network of
Bonds.

The platform is designed to accommodate every type of ﬁctional universe, including novels,
book series, games, movies, television series, anime, manga, tabletop settings, and entirely
original worlds.

Every Case evolves alongside the user's understanding of its world, allowing simple
investigations to remain simple while enabling enthusiasts to build deeply interconnected
knowledge networks without unnecessary complexity.

### 1.2 Mission Statement

LoreBound empowers readers to investigate every story by transforming ﬁctional worlds
into living knowledge networks that can be explored through Dossiers, Boards, Bonds, and
Timelines.

### 1.3 Vision Statement

LoreBound strives to become the deﬁnitive platform for exploring ﬁctional universes.

Every ﬁctional world contains histories, mysteries, relationships, and unanswered questions.
LoreBound exists to give readers a beautiful and intuitive environment where those connections
can be discovered, organized, and explored from multiple perspectives.

Rather than forcing users into a predeﬁned workﬂow, LoreBound provides ﬂexible investigative
tools that adapt to each reader's personal way of thinking.

Whether documenting three characters or three thousand, the experience should remain intuitive,
immersive, and enjoyable.

### 1.4 What LoreBound Is

LoreBound is:

- 
- 
- 
- 
- 
- 
- 

An investigation platform for ﬁctional worlds.
A visual knowledge management application.
A relationship-driven research tool.
A workspace designed around exploration and discovery.
A desktop-ﬁrst web application.
Local-ﬁrst by design during Version 1.
Built around the philosophy that information should exist once and be explored many
different ways.

### 1.5 What LoreBound Is Not

LoreBound is not:

- 
- 
- 
- 
- 
- 
- 
- 
- 

A Goodreads replacement.
A book cataloging application.
A wiki platform.
A note-taking application.
An ebook reader.
A mind-mapping application.
A generic database.
A project management tool.
An AI chatbot.

Although LoreBound may share characteristics with some of these products, its purpose is
fundamentally different.

LoreBound exists to investigate ﬁctional worlds.

### 1.6 Product Philosophy

Every design decision within LoreBound should support the following principles.

One Investigation. Many Ways to Explore It.

Information is entered once.

It can then be explored through:

- 
- 
- 
- 
- 

Dossiers
Boards
Bonds
Timelines
Search
without duplication.

Progressive Detail

Nothing in LoreBound should require the user to stop investigating.

A user can create a Character with only a name, then gradually expand that record over weeks or
months as new information is discovered.

Atmosphere Enhances Usability

LoreBound should feel immersive without sacriﬁcing efﬁciency.

The workspace should create the feeling of working inside a personal investigation archive while
maintaining the responsiveness and usability expected from modern software.

Atmosphere should never slow the user down.

Users Choose How They Investigate

LoreBound provides tools.

It does not dictate workﬂow.

Users may:

- 
- 
- 
- 

Organize information differently.
Arrange Boards differently.
Document varying levels of detail.
Build entirely different investigative approaches.

There is no single "correct" way to investigate.

Single Source of Truth

Every piece of information exists exactly once.

The Board, Timeline, Search, and Dossiers all reference the same underlying record rather than
maintaining duplicate information.

Assistance Without Control

LoreBound should actively assist the user through Smart Suggestions, Smart Boards, and
intelligent Bonds.

However, the user always remains in control.

Automation should support investigation, never replace it.

### 1.7 Design Goal

The highest compliment LoreBound can receive is:

"LoreBound should make every user feel like the lead investigator of their own ﬁctional
archive."

Every feature should reinforce that feeling.

🔒  Design Lock

The following principles are considered foundational to LoreBound and should not be changed
without deliberate review of the Design Bible.

- 
- 
- 
- 
- 
- 
- 

LoreBound is an investigation platform for ﬁctional worlds.
The platform is desktop-ﬁrst and local-ﬁrst for Version 1.
Information exists once and is explored through multiple investigative lenses.
Users choose how they investigate.
Atmosphere enhances usability rather than replacing it.
Smart features assist the user without removing control.
Every design decision should support the feeling of being the lead investigator of a
personal ﬁctional archive.

## Chapter 2

Brand Identity
"A great product is recognized long before its logo is seen."

### 2.1 Brand Name

Ofﬁcial Name

LoreBound

The name combines two core concepts that deﬁne the platform:

- 

- 

Lore: The histories, characters, places, events, and interconnected knowledge that make
ﬁctional worlds meaningful.
Bound: A dual meaning representing both the binding of books and the connections that
tie information together throughout an investigation.

The name should always be presented as a single word with a capital L and capital B.

Correct:

- 

LoreBound

Incorrect:

- 
- 
- 

Lorebound
Lore Bound
lorebound

### 2.2 Ofﬁcial Tagline

Investigate Every Story.

This tagline represents the central purpose of LoreBound.

It reinforces that the platform is not merely for reading about ﬁctional worlds, but for actively
exploring and connecting them.

The tagline should appear in locations such as:

- 
Landing page
Case Archive
- 
- Marketing material
Documentation
- 

- 

Splash screen (if implemented)

### 2.3 Logo

The ofﬁcial LoreBound logo consists of:

- 
- 
- 
- 
- 
- 
- 
- 

A minimalist open book.
A single deep crimson thread woven through the pages.
Brass-style investigation pins securing the thread at key points.
Clean vector geometry.
Flat design.
No gradients.
No shadows.
No skeuomorphic effects.

The logo represents both books and investigation simultaneously.

The thread symbolizes the Bonds connecting information throughout a ﬁctional world.

The logo should remain recognizable at favicon size while scaling cleanly to large promotional
artwork.

### 2.4 Brand Personality

LoreBound should communicate the following qualities.

Intelligent

LoreBound values thoughtful investigation over information overload.

Curious

The platform encourages exploration, discovery, and asking questions rather than simply
recording facts.

Professional

The interface should feel polished and dependable while remaining approachable.

Immersive

Users should feel as though they are working inside their own investigation archive without
sacriﬁcing modern usability.

Timeless

Design decisions should avoid trends that may quickly become dated.

The application should feel as appropriate ten years from now as it does today.

### 2.5 Brand Voice

LoreBound speaks conﬁdently, clearly, and respectfully.

The application should never feel overly playful, sarcastic, or gimmicky.

Its language should reﬂect the experience of conducting an investigation.

Examples:

Preferred

Create Case

Open Dossier

Create Bond

Explore Timeline

Search Archive

Avoid

New Project

Documents

Links

Graph

Open File

These generic software terms weaken LoreBound's identity.

### 2.6 Ofﬁcial Vocabulary

LoreBound intentionally uses its own terminology.

Standard
Software

LoreBound

Project

Case

Dashboard

Case Archive

File

Relationship

Graph

Search

Theme

Proﬁle

Database

Dossier

Bond

Board

Archive
Search

Workspace

Dossier

Archive

This vocabulary should remain consistent throughout the application.

### 2.7 Visual Identity Philosophy

The interface should combine two ideas:

Modern Software

- 
Responsive
- 
Fast
Clean
- 
- Minimal
- 
Efﬁcient
with

Investigator's Workspace

- Walnut desk
Cork board
- 
Archival paper
- 

- 
- 
- 

Brass accents
Leather notebooks
Investigation tools

Neither style should overpower the other.

LoreBound should never become either:

or

- 

- 

a realistic detective simulator,

a generic productivity application.

The balance between immersion and usability deﬁnes the visual identity of the platform.

### 2.8 Interactive Workspace Philosophy

Workspaces are functional environments rather than decorative backgrounds.

Universal actions are represented by meaningful physical objects.

Examples within the Investigator's Study:

- 🔍  Brass Magnifying Glass → Archive Search
- 🗄  Archive Cabinet → Case Archive
- 📓  Leather Notebook → Settings

Future Workspaces reinterpret these objects while preserving identical functionality.

Every object exists to support the user's investigation.

### 2.9 Identity Statement

LoreBound should be immediately recognizable from a single screenshot.

Whether the user sees:

- 
- 
- 
- 

a Dossier,
a Board,
the Case Archive,
or a Workspace,

they should immediately recognize the application as LoreBound without needing to see the
logo.

The interface itself is part of the brand.

### 2.10 Ofﬁcial Brand Palette

The ofﬁcial LoreBound palette reﬂects the platform's identity as a modern investigation
workspace inspired by books, archives, and detective boards.

Primary Colors

Deep Graphite

- 
- 

Primary interface color.
Represents stability, professionalism, and modern software.

Warm Ivory

- 
- 

Paper, archival documents, and readable surfaces.
Creates warmth without sacriﬁcing contrast.

Signature Accent

Deep Crimson

- 
- 
- 

The deﬁning LoreBound accent.
Represents Bonds, investigation, and connected knowledge.
Used sparingly for emphasis, selected actions, and brand recognition.

Secondary Accent

Brass Gold

- 
- 
- 

Reserved for subtle highlights.
Represents the physical tools of investigation.
Used for interactive Workspace Objects and premium visual accents.

Palette Philosophy

Color should support the user's investigation rather than dominate it.

The interface should remain calm, readable, and timeless.

Bright, saturated colors should be reserved for user-created content rather than the application's
interface.

🔒 Design Lock

The following elements deﬁne LoreBound's identity and should remain consistent unless
intentionally revised in a future Design Bible version.

- 
- 
- 
- 
- 
- 
- 

Ofﬁcial name: LoreBound
Ofﬁcial tagline: Investigate Every Story.
Ofﬁcial vocabulary (Cases, Boards, Bonds, Dossiers, Workspaces, Archive)
The open book and crimson thread logo
The balance between modern software and immersive investigative workspace
Interactive Workspace Objects as a deﬁning UI principle
A consistent, professional, investigation-focused voice throughout the application

## Chapter 3

Application Overview
"Every ﬁctional universe is a Case waiting to be investigated."

### 3.1 Introduction

LoreBound is designed around a single principle:

Every ﬁctional universe is a Case waiting to be investigated.

The application provides a cohesive investigative workspace where users collect, organize,
connect, and explore information through multiple interconnected systems.

Rather than requiring users to think in terms of databases, folders, or documents, LoreBound
presents information as if the user were assembling and maintaining a professional investigative
archive.

Every system within the application supports this experience.

### 3.2 User Journey

The typical LoreBound workﬂow follows a simple progression.

Launch LoreBound
│
▼
Open Case Archive
│
▼
Create or Open a Case

│
▼
Enter Workspace
│
▼
Investigate
│
┌──────┼────────┬────────┐
▼      ▼        ▼        ▼
Board Dossiers Timeline Search

The user should never feel lost.

Every feature exists to support the active investigation.

### 3.3 The Case Archive

The Case Archive is the application's home screen.

It serves as the central repository for every Case the user creates.

The archive displays:

- 
- 
- 
- 
- 
- 

LoreBound logo
Ofﬁcial tagline
Create New Case
Search Cases
Case Files
Recently Opened Cases

Each Case appears as a physical Case File featuring:

- 
- 
- 
- 
- 

User-selected cover image (optional)
Case title
Universe Type
Optional Author / Creator
Last Opened timestamp

Selecting a Case transitions into the active Workspace.

### 3.4 Creating a Case

Creating a Case should take only a few seconds.

Required

- 
- 

Case Name
Universe Type

Optional

- 
- 
- 

Cover Image
Author / Creator
Description

The goal is to allow users to begin investigating immediately.

Additional information can always be added later.

### 3.5 The Workspace

Opening a Case transitions the user into their selected Workspace.

Version 1 includes:

Investigator's Study

The Workspace consists of two equally important elements:

Environment

The immersive ofﬁce containing:

- Walnut desk
Cork board
- 
Interactive Workspace Objects
- 

Interface

Modern software components including:

- 
Sidebar
- Menus
Dialogs
- 
Search
- 
Dossiers
- 

The environment creates atmosphere.

The interface provides efﬁciency.

### 3.6 Sidebar Navigation

The sidebar serves as the primary navigation system.

Version 1 includes:

- 🧵  Board
- 👤  Characters
- 📍  Locations
- 📅  Events
- 🏛  Organizations
- 💡  Theories
- ⏳  Timeline
- ⚙  Case Settings

The sidebar remains consistent throughout the application and may be collapsed when desired.

### 3.7 Investigative Lenses

LoreBound allows users to explore the same information from multiple perspectives.

These perspectives are known as Investigative Lenses.

Version 1 includes four primary lenses.

🧾  Dossiers

Detailed records for every entity.

Purpose:

Learn about something.

🧵  Board

Visual network of interconnected records.

Purpose:

Understand relationships.

⏳  Timeline

Chronological exploration of Events.

Purpose:

Understand sequence.

🔍  Archive Search

Universal navigation.

Purpose:

Find anything instantly.

The same underlying information powers every lens.

No duplication exists between them.

### 3.8 Investigation Flow

A typical investigation might look like this:

Create Character

↓

Add Bonds

↓

Create Events

↓

Connect Locations

↓

Document Theory

↓

Attach Evidence

↓

Explore Timeline

↓

Visualize on Board

↓

Continue investigating

The workﬂow is intentionally non-linear.

Users may begin wherever they choose.

### 3.9 Progressive Investigation

LoreBound encourages continuous discovery.

Users are never expected to complete a record in one session.

Instead:

A Character may begin with only a name.

Weeks later, that Character may include:

- 
- 
- 
- 
- 

Image
Notes
Bonds
Evidence
Timeline participation

The application evolves alongside the user's understanding.

### 3.10 Universal Navigation

Users should always be able to reach any major function in multiple ways.

Examples:

Archive Search

- Workspace Object
Keyboard Shortcut
- 
Sidebar
- 

Case Archive

- 
- 

Archive Cabinet
Sidebar

Dossiers

- 
- 
- 
- 

Board
Search
Timeline
Bonds

No feature should have only a single access path.

### 3.11 The LoreBound Experience

LoreBound is intended to feel less like using software and more like maintaining a personal
investigative archive.

Every interaction should reinforce the feeling that the user is actively uncovering, connecting,
and understanding a ﬁctional world.

The application should disappear into the experience.

The investigation should remain the focus.

🔒 Design Lock

The application structure deﬁned in this chapter establishes LoreBound's primary user
experience.

Future features should integrate into this ﬂow rather than replacing it.

Speciﬁcally:

- 

The Case Archive remains the application's home.

- Workspaces remain immersive yet practical.
- 
- 
- 

The four Investigative Lenses remain the primary methods of exploration.
Every major feature should be accessible through multiple navigation paths.
The user's investigation, not the interface, remains the focus.

## Chapter 4

Core Philosophy
"Features build software. Philosophy builds products."

### 4.1 Introduction

LoreBound is not deﬁned by its features.

It is deﬁned by its philosophy.

Every screen, interaction, animation, workﬂow, and future feature should reinforce the principles
established in this chapter.

When uncertainty arises during development, these principles take precedence over convenience,
trends, or feature requests.

The philosophy of LoreBound is intended to remain stable even as the application evolves.

### 4.2 The Prime Directive

LoreBound exists to help users investigate ﬁctional worlds in a way that feels immersive,
intuitive, and intellectually rewarding.

Every feature should strengthen the investigation, reduce unnecessary friction, and preserve the
user's ownership of their archive.

If a proposed feature complicates the investigation without meaningfully improving it, it does not
belong in LoreBound.

### 4.3 The Investigator Principle

LoreBound should never ask the user to think like a database. It should allow them to think
like an investigator.

The user should naturally think about:

Characters
- 
- 
Events
- Mysteries
- 
- 
- 

Connections
Evidence
Theories

Never about:

- 
- 
- 
- 
- 

Tables
IDs
Records
Schemas
Foreign keys

The underlying technology should remain invisible.

### 4.4 One Investigation. Many Ways to Explore

It.

Every Case exists as one interconnected investigation.

Users explore that investigation through multiple Investigative Lenses:

- 🧾  Dossiers
- 📌  Boards
- ⏳  Timeline
- 🔍  Archive Search

These are different perspectives of the same information.

No investigative lens owns the data.

### 4.5 Single Source of Truth

Every piece of information exists once.

Examples:

A Character exists once.

A Bond exists once.

An Event exists once.

Everything else references those records.

This principle prevents inconsistencies and eliminates unnecessary duplication throughout the
application.

### 4.6 Progressive Detail

Users should never feel pressured to complete information immediately.

Every record begins simple.

Every record may become detailed over time.

Example:

Character

Version One:

Violet Sorrengail

Months later:

- 
- 
- 
- 
- 
- 

Portrait
Bonds
Evidence
Notes
Timeline
Custom ﬁelds (future)

The software grows with the investigation.

### 4.7 Assistance Without Control

LoreBound should actively help the user.

Examples:

- 

Smart Suggestions

- 
- 

Smart Board
Intelligent Bonds

However:

The application never assumes ownership of the investigation.

Automation should assist.

Never dictate.

### 4.8 Atmosphere Enhances Usability

The immersive workspace exists to support the investigation.

Not replace modern usability.

Examples:

Good:

- 
- 
- 
- 
Bad:

Brass magnifying glass
Archive cabinet
Cork board
Paper dossiers

- 
- 
- 
- 

Hidden functionality
Difﬁcult navigation
Decorative clutter
Slow interactions

The atmosphere should disappear once the investigation begins.

### 4.9 User Ownership

Every Case belongs to its creator.

LoreBound should never imply that there is one "correct" interpretation of a ﬁctional universe.

Users are free to:

- 
- 
- 

Build theories.
Organize differently.
Ignore optional features.

- 

Document information however they choose.

LoreBound facilitates investigation.

It does not enforce conclusions.

### 4.10 Simplicity Before Complexity

Whenever multiple solutions exist, LoreBound should favor the simpler one.

Power should emerge naturally.

Not through overwhelming conﬁguration.

Every feature should be understandable within moments of ﬁrst use.

### 4.11 The Apple Test

Every signiﬁcant feature should be explainable in one or two sentences.

If it cannot, the feature should be simpliﬁed before implementation.

Complex capability should never require complex interaction.

### 4.12 Consistency Builds Trust

Users should never wonder:

"What does this button do?"

or

"Why does this screen work differently?"

Every interaction should reinforce established patterns.

Consistency reduces cognitive load and allows users to focus entirely on the investigation.

### 4.13 Respect the User's Time

“The Three-click Rule” - Any major action in LoreBound should generally be achievable within
three intentional interactions from the user's current context.

Examples:

- 
- 
- 
- 
- 

Open a Dossier.
Add a Bond.
View a Timeline.
Create a Character.
Find an Event.

This doesn't mean every task must literally take three clicks. Some actions naturally require
more. Instead, it's a reminder that common workﬂows should never become buried behind layers
of menus.

Every click should have purpose.

Every dialog should exist for a reason.

Every workﬂow should minimize unnecessary interruption.

LoreBound should never require users to stop investigating because of the software itself.

### 4.14 The Long-Term Vision

LoreBound is not intended to be merely useful.

It should become a place users enjoy returning to.

The application should feel less like opening software...

and more like returning to their personal archive.

The experience should encourage curiosity, reward exploration, and inspire users to continue
expanding their investigations over months and years.

### 4.15 The Natural First Principle

One of LoreBound's defining philosophies is that investigators should never feel as though they are filling out a database.

Whenever multiple interaction methods are possible, LoreBound should always prefer the one that feels most natural to the investigator while preserving the integrity of the underlying knowledge.

Structured information exists to empower the investigation.

Never to burden the investigator.

Every feature introduced into LoreBound should first ask one question:

> **Can this interaction feel natural before requiring a form?**

If the answer is yes, the natural workflow should always take precedence.

Forms, dialogs, editors, and configuration panels remain valuable tools, but they should supplement investigation rather than define it.

LoreBound should always feel like a detective's notebook.

Never like database software.

---

### 4.16 Threadmarks

Threadmarks are LoreBound's native interaction language.

They allow investigators to naturally create structured knowledge simply by writing.

Rather than requiring users to manually create relationships, references, and other connections through dedicated forms, LoreBound interprets intentional Threadmarks and quietly constructs the underlying knowledge graph.

**The investigator writes naturally.**

**LoreBound builds the investigation.**

Threadmarks are intended to become a universal interaction model throughout LoreBound and should be preferred whenever they provide a more intuitive workflow than traditional data-entry interfaces.

### Design Philosophy

Every Threadmark should satisfy the following principles:

- Natural to write.
- Easy to discover.
- Consistent throughout LoreBound.
- Human-readable.
- Machine-interpretable.
- Fully reversible.
- Visually unobtrusive.

Threadmarks exist to reduce friction.

Never to introduce additional complexity.

### Relationship Threadmarks

The first implementation of Threadmarks replaces manual Bond creation.

Example:

```text
@mother @Lilith Sorrengail
@father @Asher Sorrengail
@sister @Mira Sorrengail
@brother @Brennan Sorrengail
@romanticPartner @Xaden Riorson
@bonded @Tairn
@bonded @Andarna
```

The first Threadmark identifies the relationship.

The second Threadmark identifies the referenced Dossier.

Upon saving, LoreBound automatically creates the corresponding Bond while preserving the investigator's natural writing.

### Reading vs. Writing

Threadmarks exist only while editing.

View Mode should never expose Threadmark syntax.

Instead, LoreBound should render the resulting information naturally.

Example:

```text
Bonds

Mother
Lilith Sorrengail

Father
Asher Sorrengail

Brother
Brennan Sorrengail

Sister
Mira Sorrengail

Romantic Partner
Xaden Riorson

Bonded
Tairn

Bonded
Andarna
```

The investigator experiences a polished dossier.

LoreBound manages the structured knowledge behind the scenes.

### Autocomplete

Typing the `@` character invokes the Threadmark suggestion system.

Investigators should never be expected to memorize Threadmarks.

LoreBound should guide discovery through autocomplete, intelligent searching, and contextual suggestions.

After selecting a Threadmark type, LoreBound should immediately search compatible Dossiers within the active Case.

### The Relationship Registry

Relationship Threadmarks are powered by an internal Relationship Registry.

The registry defines:

- Canonical relationship
- Accepted aliases
- Display name
- Valid target Knowledge Types
- Inverse relationship
- Validation rules
- Search behavior
- Timeline behavior
- Graph behavior

The Relationship Registry exists entirely behind the scenes.

Investigators should never interact with it directly.

New relationship types should be introduced by extending the registry rather than redesigning the interaction model.

### Automatic Inverse Relationships

Whenever a relationship can be determined with certainty, LoreBound should automatically create its inverse.

Examples include:

- Mother ↔ Daughter / Son
- Father ↔ Daughter / Son
- Brother ↔ Sister / Brother
- Sister ↔ Brother / Sister
- Mentor ↔ Student
- Leader ↔ Member
- Bonded ↔ Bonded

LoreBound should never invent uncertain information.

Only relationships that can be confidently inferred should be generated automatically.

### Future Expansion

Relationship Threadmarks represent only the first generation of the Threadmark system.

Future Threadmarks should eventually support:

- Character references
- Location references
- Organization references
- Event references
- Timeline entries
- Theory references
- Evidence references
- Investigation Board references
- Cross-Dossier references

Threadmarks should become the universal interaction language shared throughout LoreBound.

### Artificial Intelligence

Future AI capabilities may identify possible Threadmarks within ordinary prose and suggest structured relationships.

However, LoreBound shall never automatically create structured knowledge from inferred intent.

Artificial Intelligence may suggest.

Only the investigator may confirm.

Design Lock

Threadmarks are a permanent architectural philosophy of LoreBound.

Future interaction systems should extend Threadmarks rather than introduce competing methods of creating structured knowledge.

Whenever practical, investigators should be able to write naturally while LoreBound quietly constructs the interconnected investigation beneath the surface.

👨‍💻 Developer Notes

Threadmarks are not merely a replacement for the Bond editor.

They represent LoreBound's long-term interaction philosophy.

Future systems should favor natural writing over manual data entry whenever doing so improves the investigative experience without sacrificing clarity, accuracy, or user control.

🔒 Design Lock

The philosophical principles in this chapter supersede individual feature decisions.

Whenever future ideas are proposed, they should ﬁrst be evaluated against the following
questions:

- 

Does this strengthen the investigation?

- 
- 
- 
- 

Does it reduce unnecessary friction?
Does it preserve user ownership?
Does it support immersion without sacriﬁcing usability?
Does it align with the Prime Directive?

If the answer to any of these questions is "no," the proposal should be reconsidered before
implementation.

👨💻 Developer Notes

This chapter is the foundation upon which every other chapter rests.

Developers should treat these principles as architectural constraints rather than optional
guidelines.

When implementation decisions become ambiguous, choose the solution that most closely aligns
with the philosophy deﬁned here, even if another option appears technically simpler.

Consistency of experience is considered more valuable than maximizing the number of features.

# Volume II

## Chapter 5

Cases
"Every investigation begins with a single Case."

### 5.1 Purpose

A Case is the highest level of organization within LoreBound.

Every investigation exists inside a Case.

A Case represents one ﬁctional universe or one focused investigation.

Examples include:

- 

Fourth Wing

Harry Potter
The Lord of the Rings
Pokémon

- 
- 
- 
- Mass Effect
- 
- Mythos 2130

The Elder Scrolls

Cases are completely independent from one another.

No information is shared between Cases unless a future feature explicitly supports it.

### 5.2 The Case Archive

The Case Archive is LoreBound's home screen.

Its purpose is to provide quick access to every investigation.

The archive should feel like opening a ﬁling cabinet inside an investigator's ofﬁce.

Each Case appears as a physical Case File rather than a generic software card.

Every Case File displays:

- 
- 
- 
- 
- 
- 

Cover Image (optional)
Case Name
Universe Type
Author / Creator (optional)
Last Opened
Date Created

The archive should remain visually clean regardless of how many Cases exist.

### 5.3 Creating a Case

Creating a Case should take less than thirty seconds.

Required

- 
- 

Case Name
Universe Type

Optional

- 

Cover Image

- 
- 

Author / Creator
Description

After clicking Create Case, the user is immediately taken into the new Workspace.

No additional setup is required.

### 5.4 Universe Types

Universe Types help categorize Cases without changing functionality.

Version 1 includes:

- 📚  Book
- 📖  Book Series
- 🎮  Game
- 🕹  Game Series
- 🎬  Movie
- 🎞  Movie Series
- 📺  Television
- 🎌  Anime
- 📘  Manga
- 🎲  Tabletop
- ✍  Original World
- 📦  Other

Universe Type is descriptive only.

It never changes how LoreBound functions.

### 5.5 Case Philosophy

LoreBound intentionally avoids forcing users into predeﬁned structures.

For example, creating a Book Series does not automatically create:

- 
- 
- 

Book 1
Book 2
Characters

- 

Timeline

Instead, users decide how to organize their investigation.

Every Case is unique.

### 5.6 Case Organization

Users are free to organize their Case however they choose.

Examples:

Fourth Wing

Characters

Locations

Dragons

Theories

Timeline

Another user may instead organize:

Book One

Book Two

Book Three

Characters

Events

Both are equally valid.

LoreBound provides tools rather than workﬂows.

### 5.7 Case Metadata

Each Case stores general information about the ﬁctional universe.

Possible metadata includes:

- 
- 
- 
- 
- 
- 
- 

Description
Author / Creator
Cover Image
Universe Type
Creation Date
Last Modiﬁed
Last Opened

This information remains editable at any time.

### 5.8 Case Settings

Every Case contains its own settings.

Version 1 includes:

- 
- 
- 
- 

Rename Case
Change Cover Image
Change Description
Change Universe Type
Future versions may include:

- 
- 
- 
- 

Export
Import
Collaboration
Cloud Sync

### 5.9 Case Independence

Every Case is completely independent.

A Character created inside:

Fourth Wing

does not exist inside:

Harry Potter

Even if they share the same name.

This prevents accidental cross-contamination of investigations.

### 5.10 Progressive Growth

A Case should grow naturally.

A new Case may contain:

One Character

- 

or

Thousands of interconnected records.

LoreBound should remain equally usable at both scales.

### 5.11 Future Collections

Collections are intentionally excluded from Version 1.

However, the application should be architected so Collections can later become optional
organizational containers within a Case.

Collections are designed to organize information rather than deﬁne structure.

### 5.12 Case Lifecycle

Every Case follows the same lifecycle.

Create Case

↓

Investigate

↓

Expand

↓

Refine

↓

Continue Investigating

A Case is never considered "ﬁnished."

It evolves alongside the user's understanding of the ﬁctional universe.

Case Opening Animation - “The Opening Ritual”

You click the Case File.

The ﬁle slides forward from the archive.

It opens like a real folder.

The camera gently transitions into the Investigator's Study.

The folder settles onto the desk.

Then the cork board and workspace fade into view.

The entire animation lasts about 500 to 700 milliseconds.

🔒 Design Lock

The Case is the highest organizational level in LoreBound.

Future features should integrate into Cases rather than replacing them.

Speciﬁcally:

- 
- 
- 
- 
- 

Every investigation belongs to exactly one Case.
Cases remain independent.
Case organization is user-deﬁned.
Creating a Case should always remain fast and frictionless.
Universe Types categorize rather than control behavior.

👨💻 Developer Notes

The Case system intentionally avoids assumptions about how ﬁctional universes should be
organized.

By separating Case creation from Case organization, LoreBound supports both casual readers
and dedicated lore enthusiasts without forcing either into a predeﬁned workﬂow.

The data model should remain ﬂexible enough to support future organizational features, such as
Collections, while keeping Version 1 intentionally simple.

## Chapter 6

Dossiers
"Every piece of knowledge deserves a place in the archive."

### 6.1 Purpose

A Dossier is the primary interface for viewing, creating, and expanding information within a
Case.

Every meaningful piece of information in LoreBound exists as a Dossier.

Examples include:

- 
- 
- 
- 
- 

Characters
Locations
Events
Organizations
Theories

The Dossier is the user's workspace for building an investigation.

It is not simply a form or a database record.

It should feel like opening a professionally assembled investigation ﬁle.

### 6.2 Philosophy

Every Dossier should answer one question:

"What do I currently know about this?"

As the investigation grows...

The Dossier grows.

The interface should evolve naturally alongside the information.

### 6.3 Visual Identity

Every Dossier shares the same design language.

Characteristics include:

Archival paper
Binder holes
Typewriter-inspired headings
Clean modern body text
Optional clipped photograph
Clearly separated sections

- 
- 
- 
- 
- 
- 
- Minimal visual clutter

Regardless of record type, every Dossier should immediately feel like part of LoreBound.

### 6.4 View Mode

View Mode represents the ﬁnished investigative document.

The experience should prioritize reading and exploration.

Users should be encouraged to browse information rather than constantly entering edit mode.

### 6.5 Edit Mode

Edit Mode should preserve immersion.

Instead of replacing the Dossier with a traditional software form...

Fields become editable directly within the document.

Example:

View:

Name

Violet Sorrengail

↓

Edit

Name

[Violet Sorrengail             ]

The Dossier remains visually consistent throughout editing.

### 6.6 Progressive Information Density

A Dossier should only display information that currently exists.

For example:

A newly created Character may display only:

- 
- 
- 

Overview
Bonds
Notes

As additional information is added...

New sections naturally appear.

Examples:

- 
- 
- 
- 

Evidence
Timeline
Appearance
Abilities

Empty sections should remain hidden until they become useful.

This allows Dossiers to grow organically without overwhelming new users.

### 6.7 Optional Images

Every Dossier supports an optional image.

Examples:

Character

- 

Portrait

Location

Artwork

- 
- Map
Organization

Crest
Emblem

Symbol
Screenshot

- 
- 
Event

- 
- 
Theory

- 
- 

Diagram
Evidence Image

Images are optional.

The Dossier should remain visually complete even without one.

### 6.8 Universal Sections

Every Dossier shares several common sections.

Overview

General information.

Bonds

Connections to other Dossiers.

Notes

User observations.

Evidence

Supporting references.

These common sections create consistency across every record type.

### 6.9 Record-Speciﬁc Sections

Each Dossier also contains sections unique to its record type.

Examples:

Character

- 
- 
- 

Appearance
Personality
Occupation

Location

- 
- 

Geography
Climate

Organization

Leadership
Purpose

- 
- 
Theory

- 
- 
- 

Supporting Evidence
Contradicting Evidence
Conﬁdence

LoreBound should provide sensible defaults while allowing room for future customization.

### 6.10 Navigation

Every Bond inside a Dossier is interactive.

Selecting a Bond immediately opens the connected Dossier.

This allows users to naturally move through the investigation without repeatedly using Search.

The archive should feel interconnected.

### 6.11 Timeline Integration

Every Dossier includes:

Explore Timeline

Rather than maintaining a separate timeline...

LoreBound automatically displays every Event connected to the current Dossier.

This reinforces the principle of:

One Investigation.

Many Ways to Explore It.

### 6.12 Information Ownership

A Dossier owns information.

The Board does not.

The Timeline does not.

Search does not.

Those systems visualize Dossiers.

The Dossier remains the authoritative source.

### 6.13 Reading Experience

Reading should always be more comfortable than editing.

Typography.

Spacing.

Contrast.

Margins.

Everything should encourage long reading sessions.

LoreBound is intended to be used for hours at a time.

Comfort matters.

### 6.14 The Living Document

No Dossier is ever considered complete.

As new books release...

Games receive DLC...

Shows gain new seasons...

The Dossier evolves.

LoreBound should celebrate continuous discovery rather than completion.

Dossier Opening Ritual - “The Dossier Reveal”

Just as opening a Case has The Opening Ritual, opening a Dossier has The Dossier Reveal.

These little named interactions become part of LoreBound's identity and give developers a
common language.

For example:

"The Dossier Reveal should use the standard easing curve."

or

"This transition should feel like the Opening Ritual."

That's the kind of consistency that makes software feel polished.

🔒 Design Lock

Dossiers are the authoritative source of knowledge within LoreBound.

Every other Investigative Lens references them.

Speciﬁcally:

- 
- 
- 
- 
- 

Every record is represented by a Dossier.
Dossiers grow over time.
Empty information should remain hidden until useful.
Editing should preserve immersion.
Navigation between Dossiers should feel effortless.

👨💻 Developer Notes

The Dossier system is intentionally designed to reduce cognitive load.

Instead of overwhelming users with dozens of empty ﬁelds, the interface reveals complexity
gradually as investigations mature.

This approach allows LoreBound to remain approachable for new users while scaling naturally
to extremely detailed investigations.

Developers should prioritize readability over density and ensure that every Dossier feels like a
document someone would genuinely enjoy reading.

## Chapter 7

The Bond System
"Knowledge becomes understanding when its connections are revealed."

### 7.1 Purpose

The Bond System is the relational engine that powers LoreBound.

Rather than treating records as isolated pieces of information, the Bond System creates
meaningful connections between Dossiers, allowing every investigation to evolve into an
interconnected knowledge network.

Every major system within LoreBound is enhanced by Bonds.

This includes:

- 

Boards

- 
- 
- 
- 
- 

Dossiers
Timeline
Archive Search
Smart Suggestions
Future Investigative Lenses

Without Bonds, LoreBound becomes a collection of documents.

With Bonds, it becomes an investigation.

### 7.2 Philosophy

A Bond represents a meaningful relationship between two Dossiers.

Bonds are ﬁrst-class citizens within LoreBound.

They are not text ﬁelds.

They are not hyperlinks.

They are living connections that remain synchronized throughout the entire Case.

### 7.3 Universal Bond Model

Any Dossier may be connected to any other Dossier.

Examples:

Character ↔ Character

Character ↔ Location

Character ↔ Event

Character ↔ Organization

Character ↔ Theory

Location ↔ Event

Organization ↔ Event

Theory ↔ Event

The system intentionally avoids limiting what may be connected.

The investigation deﬁnes the relationships.

### 7.4 Smart Bonds

A Bond should only need to be created once.

Example:

Violet

↓

Mother

↓

Lilith

Immediately creates:

Lilith

↓

Daughter

↓

Violet

The user never manually enters both sides of the same relationship.

### 7.5 Bond Categories

Version 1 supports three categories of Bond behavior.

Symmetric

Both records receive the same relationship.

Examples:

- 
- 
- 
- 

Sibling
Ally
Romantic Partner
Rival

Inverse

Each record receives an opposite relationship.

Examples:

- 
Parent ↔ Child
- Mentor ↔ Student
- 
Leader ↔ Member
- 
Rider ↔ Dragon

Directional

Only one record receives the Bond.

Examples:

Suspects
- 
Defeated
- 
Inspired
- 
- 
Inﬂuenced
- Mentions

These relationships intentionally do not create automatic reciprocals.

### 7.6 Bond Navigation

Every Bond is interactive.

Selecting a Bond immediately opens the connected Dossier using the standard Dossier Reveal
interaction.

Navigation through Bonds should feel effortless.

Users should naturally move through an investigation by following relationships.

### 7.7 Bond Evidence

Every Bond supports optional Evidence.

Evidence may include:

- 
- 
- 
- 
- 
- 
- 
- 

Book
Chapter
Page
Episode
Scene
Game
Developer Commentary
Personal Notes

Evidence is never required.

Users should always be able to investigate ﬁrst and document supporting material later.

### 7.8 Bond Status

Every Bond may optionally include a status.

Version 1 includes:

- 
- 
- 
- 
- 

Conﬁrmed
Theory
Unknown
Disputed
Debunked

Status provides additional investigative context without changing the Bond itself.

### 7.9 Bond Intelligence

The Bond System continuously assists the user.

Examples:

Creating a Character Bond may suggest creating missing Dossiers.

Creating an Event may suggest connecting participating Characters.

Creating a Location may suggest Organizations already associated with it.

Assistance should always remain optional.

### 7.10 Bonds Across Investigative Lenses

The same Bond powers every Investigative Lens.

Board

Visual connection.

Timeline

Shared Events.

Search

Contextual relationships.

Dossier

Relationship information.

Future Investigative Lenses

Automatically inherit existing Bonds.

The Bond exists once.

Everything else references it.

### 7.11 Bond Visualization

The Board visualizes Bonds.

The Dossier documents Bonds.

The Timeline contextualizes Bonds.

Search discovers Bonds.

No system owns the Bond.

Only the Bond System owns the Bond.

### 7.12 Progressive Growth

A Bond may begin as simple as:

Violet

↓

Sibling

↓

Mira

Months later, that same Bond may contain:

- 
- 
- 
- 

Evidence
Notes
Status
Additional context

The Bond grows alongside the investigation.

### 7.13 Performance Philosophy

The Bond System should scale from:

A handful of records...

to...

Thousands of Dossiers connected by tens of thousands of Bonds.

Performance should remain responsive regardless of investigation size.

### 7.14 The Living Knowledge Network

Every Bond strengthens the investigation.

Over time, isolated Dossiers become an interconnected archive.

The user should gradually feel as though they are uncovering the hidden structure of the ﬁctional
world rather than manually organizing notes.

This transformation represents the core experience of LoreBound.

Bond Connection Animation - “The Living Bond”

Example

User creates:

Violet

↓

Mother

↓

Lilith

The sequence becomes:

Thread extends naturally across the cork board.

1. Brass pushpin appears beside Violet.
2. Crimson thread wraps around the pin.
3.
4. Destination pushpin appears.
5.
6.

Thread loops around the destination pin.
Thread gently tightens.

Complete.

Roughly 600ms.

Not ﬂashy.

Just satisfying.

Deleting a Bond becomes equally elegant.

Instead of:

Poof.

Gone.

The thread gently loosens...

Retracts...

The destination pin disappears...

The originating pin remains if it's still connected elsewhere.

It feels like someone physically removed the string from the board.

🔒 Design Lock

The Bond System is the relational foundation of LoreBound.

Future features should extend the Bond System rather than creating parallel relationship models.

Speciﬁcally:

- 
- 
- 
- 
- 

Every Bond exists exactly once.
Smart Bonds maintain synchronization automatically.
Evidence remains optional.
Users create relationships once.
The Bond System powers every Investigative Lens.

👨💻 Developer Notes

The Bond System should be treated as a core architectural service rather than a feature.

Future systems should ask:

"How does this integrate with Bonds?"

rather than introducing independent relationship mechanisms.

Maintaining one intelligent relationship engine ensures consistency, reduces duplication, and
allows every new feature to immediately beneﬁt from the existing investigative network.

Interlude
The Five Pillars of LoreBound
"Every feature should strengthen the investigation, not compete with it."

Purpose

LoreBound is built upon ﬁve foundational pillars.

These pillars represent the core systems of the application.

Every present and future feature should reinforce one or more of these pillars.

If a proposed feature cannot naturally integrate into at least one pillar, it should be reconsidered.

The Five Pillars

LoreBound
│
┌─────────────────────┼─────────────────────┐
│                     │                     │
Cases              Dossiers               Bonds
│                     │                     │
└─────────────────────┼─────────────────────┘
│
Boards
│
Investigative Lenses

📂  Cases

Purpose

Contain the investigation.

Cases deﬁne the boundaries of a ﬁctional universe and provide the highest level of organization
within LoreBound.

Everything belongs to a Case.

Without Cases, investigations have no context.

🧾  Dossiers

Purpose

Store the knowledge.

Dossiers are the authoritative source of every meaningful piece of information.

Every Character, Event, Location, Organization, and Theory exists as a Dossier.

All other systems reference them.

🧵  Bonds

Purpose

Connect the knowledge.

Bonds create meaningful relationships between Dossiers.

They transform isolated records into an interconnected investigation.

Every major system depends on the Bond System.

📌  Boards

Purpose

Visualize the knowledge.

Boards provide a visual representation of the investigation.

They help users discover patterns, relationships, and structures that may not be obvious when
reading Dossiers alone.

Boards never own information.

They visualize it.

🔎  Investigative Lenses

Purpose

Explore the knowledge.

Investigative Lenses allow users to explore the same investigation through different perspectives.

Version 1 includes:

- 
- 
- 
- 

Dossiers
Boards
Timeline
Archive Search

Future lenses may be added without changing the underlying investigation.

Architectural Philosophy

The Five Pillars are not independent systems.

They continuously reinforce one another.

Example:

Character created

↓

Character Dossier

↓

Bond established

↓

Board updates

↓

Timeline gains context

↓

Search gains relationships

The user performs one action.

LoreBound intelligently strengthens every investigative lens.

Future Development Rule

Every new feature should answer one question before implementation:

Which pillar does this strengthen?

If the answer is unclear...

The feature probably does not belong in LoreBound.

🔒 Architectural Lock

The Five Pillars represent the permanent conceptual architecture of LoreBound.

Future versions may expand these pillars but should never replace them.

Every signiﬁcant system should integrate into this architecture rather than introducing competing
concepts.

👨💻 Developer Notes

This page should be considered the architectural compass of the project.

When designing new functionality, developers should identify which pillar the feature
strengthens and ensure it integrates with the existing ecosystem rather than bypassing it.

The strength of LoreBound comes from the interaction between its pillars, not from the
complexity of any individual system.

## Chapter 8

Boards
"Connections become discoveries when they can be seen."

### 8.1 Purpose

The Board is LoreBound's visual investigation space.

It allows users to explore relationships between Dossiers by arranging them on a digital cork
board connected through Bonds.

Unlike a traditional graph, the Board is designed to feel like a real detective's investigation wall
while retaining the precision and responsiveness of modern software.

The Board exists to reveal understanding through visualization.

### 8.2 Philosophy

The Board is not the source of truth.

It is a living visualization of the investigation.

Every card displayed on the Board references an existing Dossier.

Every string drawn on the Board represents an existing Bond.

The Board never owns information.

It displays information.

### 8.3 Board Modes

LoreBound supports two Board Modes.

🎨  Manual Board

Designed for users who enjoy arranging their investigations.

Features include:

- 
- 
- 
- 
- 
- 

Drag and drop placement
Zoom
Pan
Freeform layouts
Custom clusters
Smart Suggestions

Nothing moves unless the user chooses to move it.

🧠  Smart Board

Designed for users who prefer automatic organization.

The Smart Board:

- 
- 
- 
- 

Places records automatically
Groups related information intelligently
Updates continuously as new Dossiers and Bonds are created
Requires no manual layout

Users remain free to inspect and explore the Board without managing placement.

### 8.4 Board Independence

Manual and Smart Boards maintain separate layouts.

Users may switch freely between them without losing either arrangement.

The underlying investigation remains unchanged.

Only the visualization changes.

### 8.5 Smart Suggestions

The Board actively assists the user.

Examples:

- 
- 

Add connected Dossiers already linked by Bonds.
Suggest missing related records.

- 
- 

Offer to display newly created Bonds.
Recommend expanding investigation clusters.
Suggestions should be subtle, optional, and non-disruptive.

### 8.6 Board Navigation

The Board is fully interactive.

Users can:

- 
- 
- 
- 
- 

Double-click a card to perform the Dossier Reveal.
Pan and zoom smoothly.
Select multiple records.
Create visual clusters.
Follow Bonds naturally through the investigation.

Navigation should feel ﬂuid regardless of investigation size.

### 8.7 Board Clusters

Users may group related records into visual clusters.

Clusters improve readability without affecting the underlying data.

Examples:

Family
Dragons
Kingdoms
Political Factions

- 
- 
- 
- 
- Magic
- 

Book One

Clusters are purely organizational.

They never create or modify Bonds.

### 8.8 Board Views

The Board represents one visualization of the investigation.

Future versions may introduce additional visual views such as:

- 

Family Tree

- 
- 
- 

Organization Hierarchy
Geographic Map
Timeline Network

These are alternate visualizations of the same underlying investigation.

No duplicate information should ever be created.

### 8.9 Visual Philosophy

The Board should evoke the feeling of a real detective cork board.

Design elements include:

- 
- 
- 
- 
- 
- 

Cork texture
Pushpins
Red thread representing Bonds
Natural spacing
Smooth animations
Clear readability

Visual atmosphere should always support usability.

### 8.10 The Investigation Never Stops

Users should be able to investigate continuously without leaving the Board.

Examples:

- 
- 
- 
- 
- 

Open Dossiers.
Follow Bonds.
Add connected records.
Search.
Explore Timelines.

The Board serves as a living command center rather than a static visualization.

🔒 Design Lock

The Board is an investigative visualization.

It does not own information.

Speciﬁcally:

Every card represents an existing Dossier.
Every string represents an existing Bond.

- 
- 
- Manual and Smart Boards coexist.
- 
- 

Smart Suggestions assist but never interrupt.
Users always remain in control of layout and investigation.

👨💻 Developer Notes

The Board should feel responsive, tactile, and enjoyable to use.

Animations should communicate intent rather than decoration.

Performance is critical.

Even very large investigations should remain smooth and interactive.

The Board is expected to become one of LoreBound's most recognizable interfaces and should
therefore receive particular attention to usability, visual polish, and interaction quality.

## Chapter 9

Timeline
"Every story unfolds through time. Every investigation should reveal it."

### 9.1 Purpose

The Timeline is one of LoreBound's primary Investigative Lenses.

Its purpose is to organize and explore Events chronologically while revealing how Characters,
Locations, Organizations, and Theories intersect throughout the history of a Case.

The Timeline is not a manually maintained feature.

It is automatically generated from the investigation itself.

### 9.2 Philosophy

The Timeline is another perspective of the same investigation.

Users do not build timelines separately.

Instead:

They create Dossiers.

They establish Bonds.

They document Events.

LoreBound assembles those pieces into a chronological investigation.

The Timeline is a living reﬂection of the Case.

### 9.3 Timeline Types

LoreBound supports two timeline perspectives.

🌍  Global Timeline

Displays every Event within the Case.

Purpose:

Understand the complete history of the ﬁctional universe.

🎯  Focused Timeline

Generated automatically from any Dossier.

Purpose:

Understand the history of a speciﬁc subject.

Examples:

- 
- 
- 
- 

Character Timeline
Location Timeline
Organization Timeline
Theory Timeline

The Focused Timeline displays only Events connected through Bonds.

### 9.4 Events Drive the Timeline

Events are the foundation of every Timeline.

Characters, Locations, Organizations, and Theories do not appear independently.

Instead, they participate in Events.

This keeps the Timeline focused, readable, and consistent.

### 9.5 Explore Timeline

Every Dossier includes:

Explore Timeline

Selecting this option opens a Focused Timeline centered on the current Dossier.

The Timeline automatically ﬁlters itself without requiring any additional setup from the user.

### 9.6 Chronology

LoreBound supports multiple forms of chronology.

Exact Chronology

Examples:

Year

- 
- Month
- 

Day

Used when precise dates exist.

Approximate Chronology

Examples:

Early Spring
Approximately 600 years ago

- 
- 
- Mid-Winter

Supports worlds where exact dates are unknown.

Relative Chronology

Events may be positioned relative to other Events.

Examples:

- 
- 
- 

Before
After
During

This allows users to build meaningful timelines even when ofﬁcial dates do not exist.

### 9.7 Timeline Filters

Users may explore different perspectives of the same history.

Examples:

- 
- 
- 
- 
- 

Personal Events
Family Events
Organizational Events
Global Events
Location Events

Filters should never modify the investigation.

They only change what is currently displayed.

### 9.8 Timeline Navigation

Every Event displayed within the Timeline is interactive.

Users may:

- 
- 
- 
- 

Open the Event Dossier
Open connected Dossiers
Follow Bonds
Explore related Events

The Timeline is an investigative tool, not a static chart.

### 9.9 Living Timeline

The Timeline updates automatically.

Creating a new Event.

Connecting a Character.

Adding a Bond.

Editing chronology.

All changes are immediately reﬂected throughout the Timeline.

No manual rebuilding is ever required.

Timeline Scrubbing

“The Timeline Ruler”

Imagine you're scrolling through the Timeline.

Instead of using a traditional scrollbar...

There's a brass timeline ruler running down the side.

As you drag it:

Events glide smoothly into view.

- 
- Major Events subtly enlarge as they pass the center.
- 

The currently focused Event gently "snaps" into place.

It feels less like scrolling a webpage and more like physically sliding through a historical
archive.

It doesn't replace the mouse wheel or trackpad. Those continue to work normally.

### 9.10 Timeline Integrity

The Timeline does not own chronological information.

Chronology belongs to Events.

The Timeline visualizes those Events.

This preserves LoreBound's Single Source of Truth.

### 9.11 Timeline Philosophy

The Timeline should help users answer questions such as:

- When did this happen?
- What happened next?
- What Events involved this Character?
- Which Organizations were active?
How did this Theory evolve?
- 

The Timeline should encourage discovery rather than merely displaying dates.

### 9.12 Future Expansion

The Timeline architecture should support future features such as:

- Multiple calendars
Alternate timelines
- 
Branching histories
- 
Timeline comparison
- 
Timeline snapshots
- 

These capabilities should extend the Timeline without altering its underlying philosophy.

🔒 Design Lock

The Timeline is an Investigative Lens.

It visualizes Events.

It does not own chronology.

Speciﬁcally:

- 
- 

Events deﬁne chronology.
Focused Timelines are generated automatically.

- 
- 
- 

Relative chronology is fully supported.
Users never build separate timelines.
Timeline updates occur automatically as the investigation evolves.

👨💻 Developer Notes

The Timeline should remain one of the simplest Investigative Lenses from the user's perspective.

Its complexity belongs behind the scenes.

Users should feel that chronology naturally emerges from their investigation rather than
requiring additional work.

Performance should remain responsive regardless of timeline size, and navigation should
encourage exploration rather than passive viewing.

## Chapter 10

Archive Search
"Every answer should be only moments away."

### 10.1 Purpose

Archive Search is LoreBound's universal navigation and discovery system.

Rather than functioning as a traditional search bar, Archive Search serves as the central
command center for locating, navigating, and exploring every element of an investigation.

Users should never need to remember where information is stored.

They simply search.

### 10.2 Philosophy

Archive Search exists to remove friction from investigation.

Searching should feel immediate, intelligent, and contextual.

The goal is not merely to locate information.

The goal is to help users continue investigating with as little interruption as possible.

### 10.3 Universal Search

Archive Search indexes every searchable object within a Case.

Version 1 includes:

- 
- 
- 
- 
- 
- 

Cases
Characters
Locations
Events
Organizations
Theories

Future versions may extend this to additional record types without altering the search experience.

### 10.4 Access Methods

Archive Search is always available.

Users may open it through:

Interactive Workspace Object

🔍  Brass Magnifying Glass

Keyboard Shortcut

- ⌘K (macOS)
- 

Ctrl+K (Windows)

Sidebar

Archive Search remains accessible through the primary navigation interface.

No functionality should ever require keyboard shortcuts.

### 10.5 Search Results

Results should provide context before navigation.

Rather than returning only names, Archive Search displays a concise summary.

Example:

Violet Sorrengail

Character

- 
- 
- 
- 

42 Bonds
18 Events
3 Organizations
4 Theories
Available actions:

- 
- 
- 

Open Dossier
Explore Timeline
Focus on Board

Search should help users decide where they want to go before they leave the search window.

### 10.6 Context Awareness

Archive Search understands the user's current investigation.

Examples:

Searching from the Board:

If the record already exists on the current Board:

The Board smoothly pans and centers on it.

If it does not exist:

LoreBound offers:

Add to Board and Focus

The search experience should adapt to the user's current context.

### 10.7 Recent Activity

Archive Search remembers recently opened records.

Recent items should appear automatically before typing.

This encourages rapid navigation during long investigation sessions.

### 10.8 Intelligent Ranking

Results should prioritize relevance over strict alphabetical order.

Factors may include:

- 
- 
- 
- 

Exact matches
Frequently opened records
Recently viewed records
Current investigation context

Search should feel intuitive rather than mechanical.

### 10.9 Search Philosophy

Users should never think:

"Where did I save that?"

Instead, they should think:

"I know it's somewhere."

Then search ﬁnds it.

Archive Search removes organizational anxiety by allowing users to trust the investigation rather
than memorizing its structure.

### 10.10 Search as an Investigative Lens

Archive Search is itself an Investigative Lens.

It does more than locate information.

It reveals connections.

Every search result should strengthen understanding rather than merely providing navigation.

### 10.11 Future Expansion

The search architecture should support future capabilities such as:

- 
- 
- 
- 
- 
- 

Natural language search
AI-assisted investigation
Saved searches
Advanced ﬁlters
Search history
Cross-case searching (optional)

These additions should enhance Archive Search without changing its core philosophy.

🔒 Design Lock

Archive Search is the universal navigation system of LoreBound.

It exists to reduce friction while strengthening investigation.

Speciﬁcally:

Search should always remain immediately accessible.

- 
- Multiple access methods should always exist.
- 
- 
- 

Results should provide context before navigation.
Search should adapt to the user's current activity.
Users should never need to remember where information is stored.

👨💻 Developer Notes

Archive Search should feel instantaneous.

Performance expectations are extremely high.

Users should develop complete conﬁdence that typing a name will immediately surface the
correct record.

Search should minimize interruption, encourage exploration, and remain one of the fastest
interactions within the application.

## Chapter 11

Knowledge Types
"Every investigation is built from different kinds of knowledge. Understanding their
purpose is the ﬁrst step toward understanding the world."

### 11.1 Purpose

Knowledge Types deﬁne the kinds of information that can exist within a Case.

Rather than treating every piece of information as identical, LoreBound recognizes that different
forms of knowledge serve different investigative purposes.

Each Knowledge Type has its own identity while sharing a common design language through
Dossiers, Bonds, Notes, and Evidence.

Together, they form the foundation of every investigation.

### 11.2 Design Philosophy

Knowledge Types should feel intuitive.

A user should immediately know where new information belongs without needing to understand
databases or technical structures.

Every Knowledge Type answers a different investigative question.

Knowledge
Type

Character

Location

Event

Organization

Primary Question

Who?

Where?

What happened?

Who works
together?

Theory

What might be true?

This philosophy should guide future Knowledge Types as LoreBound evolves.

### 11.3 Universal Structure

Every Knowledge Type is represented by a Dossier.

Every Dossier shares several common components.

Required

- 

Name

Optional

- 
- 
- 
- 

Image
Notes
Evidence
Bonds

These shared components create consistency across the application.

### 11.4 Character

Purpose

Represents any individual capable of participating in the ﬁctional world.

Characters may include:

Humans
- 
Dragons
- 
Animals
- 
Pokémon
- 
- 
Gods
- Monsters
- 
- 

Artiﬁcial Intelligence
Any other sentient or signiﬁcant being

Characters participate in Events, belong to Organizations, occupy Locations, and form Bonds
with other Dossiers.

### 11.5 Location

Purpose

Represents any physical place within the ﬁctional universe.

Examples include:

- 
- 
- 
- 
- 
- 
- 

Cities
Buildings
Kingdoms
Continents
Planets
Rooms
Battleﬁelds

Locations provide the setting in which Events occur and Characters interact.

### 11.6 Event

Purpose

Represents a moment in time that advances the history of the ﬁctional world.

Events are the chronological foundation of LoreBound.

Examples include:

- 
- 
- 
- 
- 
- 
- 

Battles
Discoveries
Deaths
Births
Coronations
Expeditions
Catastrophes

Events drive the Timeline and connect multiple Knowledge Types together.

### 11.7 Organization

Purpose

Represents structured groups united by a common identity or purpose.

Examples include:

Kingdoms
- 
- 
Guilds
- Military units
Governments
- 
Schools
- 
Secret societies
- 
Religious orders
- 

Organizations connect Characters, Locations, and Events through shared membership or
inﬂuence.

### 11.8 Theory

Purpose

Represents user-created interpretations, predictions, and unresolved investigations.

Unlike other Knowledge Types, Theories are intentionally subjective.

Examples include:

Predictions
Fan theories
Timeline hypotheses
Character motivations
Identity speculation

- 
- 
- 
- 
- 
- Worldbuilding interpretations

Theories exist to encourage investigation rather than declare truth.

### 11.9 Knowledge Growth

Every Knowledge Type begins simple.

A Character may begin with only a name.

A Theory may begin with a single sentence.

A Location may begin with only a title.

LoreBound encourages users to expand their knowledge naturally over time.

No Dossier should ever feel incomplete simply because it contains little information.

### 11.10 Evidence

Every Knowledge Type supports optional Evidence.

Evidence strengthens understanding without becoming mandatory.

Examples include:

- 
- 
- 
- 
- 
- 

Book and chapter
Episode
Game mission
Developer interview
Companion guide
User note

Evidence exists to support knowledge, not gate it.

### 11.11 Bonds

Every Knowledge Type may form Bonds with other Knowledge Types.

Examples:

Character → Character

Character → Event

Location → Event

Organization → Character

Theory → Event

No artiﬁcial restrictions should exist unless they clearly improve the investigation experience.

### 11.12 Extensibility

The architecture should support future Knowledge Types without requiring changes to existing
investigations.

Potential future additions include:

Species
- 
- 
Artifacts
- Magic Systems
- 
- 
- 
- 

Technologies
Historical Eras
Languages
Cultures

Future Knowledge Types should follow the same design philosophy established in this chapter.

🔒 Design Lock

Knowledge Types deﬁne what users investigate.

They should remain intuitive, ﬂexible, and consistent.

Speciﬁcally:

- 
- 
- 
- 
- 

Every Knowledge Type is represented by a Dossier.
Every Knowledge Type supports Bonds.
Every Knowledge Type supports Notes.
Every Knowledge Type supports optional Evidence.
New Knowledge Types should extend the system rather than replacing it.

👨💻 Developer Notes

Knowledge Types should be implemented as extensions of a common Dossier framework rather
than entirely separate systems.

This ensures visual consistency, simpliﬁes maintenance, and allows future Knowledge Types to
inherit the same investigative capabilities with minimal additional development.

Developers should avoid creating one-off behaviors that only apply to a single Knowledge Type
unless they signiﬁcantly improve the investigation experience.

# Volume III

## Chapter 12

Version 1 Scope
"A ﬁnished foundation is more valuable than an unﬁnished masterpiece."

### 12.1 Purpose

Version 1 establishes the foundation upon which every future version of LoreBound will be built.

The goal of Version 1 is not to include every planned feature.

The goal is to deliver a polished, stable, and enjoyable investigation platform that fully embodies
the philosophy deﬁned throughout this Codex.

Every feature included in Version 1 should strengthen the core experience.

Everything else can wait.

### 12.2 The Version 1 Goal

Version 1 will be considered successful when a user can comfortably investigate an entire
ﬁctional universe without feeling limited by the software.

The focus is not on feature quantity.

The focus is on experience quality.

### 12.3 Core Features

The following systems are required for Version 1.

📂  Cases

- 

Create Case

- 
- 
- 
- 
- 

Edit Case
Delete Case
Case Archive
Cover Images
Universe Types

🧾  Dossiers

Support for:

- 
- 
- 
- 
- 

Characters
Locations
Events
Organizations
Theories

Including:

- 
- 
- 
- 

Notes
Evidence
Images
Bonds

🧵  Bond System

- 
- 
- 
- 
- 

Smart Bonds
Bond Discovery
Reciprocal Bonds
Bond Status
Bond Evidence

📌  Boards

- Manual Board
- 
- 
- 
- 
- 
- 

Smart Board
Smart Suggestions
Clusters
Zoom
Pan
Dossier Reveal

⏳  Timeline

- 
- 
- 
- 
- 

Global Timeline
Focused Timeline
Relative Chronology
Exact Chronology
Explore Timeline

🔍  Archive Search

- 
- 
- 
- 

Universal Search
Context Awareness
Recent Searches
Intelligent Results

🏢  Workspace

Investigator's Study

Including:

- 
- 
- 
- 
- 

Interactive Workspace Objects
Opening Ritual
Living Bond
Timeline Ruler
Dossier Reveal

### 12.4 Version 1 Principles

Every Version 1 feature must satisfy these conditions.

Stable

Reliability is more important than feature count.

Responsive

Performance should remain excellent.

Intuitive

Users should understand features naturally.

Consistent

Interactions should behave predictably throughout the application.

Complete

Included systems should feel ﬁnished rather than experimental.

### 12.5 Explicitly Excluded

The following features are intentionally excluded from Version 1.

Collaboration

Multi-user editing.

Cloud Sync

Local-ﬁrst remains the priority.

Mobile Applications

Desktop-ﬁrst.

AI Assistance

Beyond future architectural preparation.

Public Sharing

Cases remain private.

Templates

Custom Dossier templates.

Collections

Advanced organization.

Custom Knowledge Types

Only the ﬁve core Knowledge Types.

Theme Marketplace

Only the Investigator's Study Workspace.

Multiple Workspaces

Additional Workspaces are postponed.

Plugins

No extension ecosystem.

Online Accounts

No authentication required.

### 12.6 Success Criteria

Version 1 is complete when a user can:

- 
- 
- 
- 

Create multiple Cases.
Build detailed Dossiers.
Form intelligent Bonds.
Explore through every Investigative Lens.

- Maintain large investigations comfortably.
- 

Enjoy using LoreBound for extended sessions.

If these goals are achieved, Version 1 succeeds regardless of how many future features remain.

### 12.7 The Discipline Rule

Version 1 should resist unnecessary expansion.

New ideas should be recorded within the Future Roadmap rather than immediately implemented.

Protecting the quality of Version 1 is more important than increasing its scope.

🔒 Design Lock

Version 1 deﬁnes the foundation of LoreBound.

Future versions should expand this foundation rather than replacing it.

Speciﬁcally:

- 
- 
- 
- 

Stability takes precedence over new features.
Core systems must feel complete.
Deferred ideas remain documented but unimplemented.
Version 1 should represent a cohesive product rather than a technology demonstration.

👨💻 Developer Notes

When development priorities conﬂict, always favor polishing an existing feature over
introducing a new one.

The ﬁrst public version of LoreBound should inspire conﬁdence.

A smaller application that feels reﬁned is preferable to a larger application ﬁlled with unﬁnished
concepts.

## Chapter 13

Future Roadmap
"Every great product grows with intention, not impulse."

### 13.1 Purpose

The Future Roadmap preserves ideas that align with LoreBound's long-term vision while
protecting the scope of Version 1.

Recording future ideas prevents them from being forgotten without allowing them to interrupt
the development of the current milestone.

Every feature listed in this chapter has been intentionally postponed.

Its inclusion here does not guarantee implementation.

Rather, it acknowledges that the idea aligns with LoreBound's philosophy and should be
reconsidered after Version 1 reaches maturity.

### 13.2 Roadmap Philosophy

Future development should always follow three principles:

Build on the Foundation

New features should extend existing systems rather than replacing them.

Preserve Simplicity

Power should emerge from existing systems whenever possible.

Avoid introducing entirely new workﬂows when an existing one can be enhanced.

Respect the Investigation

Every feature should make investigating easier, richer, or more enjoyable.

If it does not strengthen the investigation, it does not belong in LoreBound.

### 13.3 Planned Evolution

The following roadmap represents the intended direction of LoreBound after Version 1.

Phase II

Personalization

Focus:

Making each investigation feel uniquely the user's own.

Potential additions:

Additional Workspaces

- 
- Workspace customization
- 
- 
- 
- 
- 

Theme selection
Interactive Workspace Objects unique to each theme
Dossier Templates
Board presets
Custom Board Views

Phase III

Expansion

Focus:

Allowing larger and more sophisticated investigations.

Potential additions:

- 
- 
- 
- 
- 
- 
- 
- 

Collections
Custom Knowledge Types
Timeline comparison
Alternate timelines
Branching histories
Saved searches
Advanced ﬁltering
Import and export improvements

Phase IV

Intelligence

Focus:

Helping users investigate more effectively.

Potential additions:

- 
- 
- 
- 
- 
- 
- 

Search as Conversation
AI-assisted search
Duplicate detection
Intelligent suggestions
Investigation insights
Relationship discovery
Timeline anomaly detection

Artiﬁcial intelligence should always assist the investigator.

It should never replace the investigator.

Phase V

Connectivity

Focus:

Sharing and collaboration.

Potential additions:

Cloud synchronization

- 
- Multi-device support
Collaboration
- 
Shared investigations
- 
Public Case publishing
- 
Community templates
- 

User ownership remains the highest priority.

### 13.4 Ideas Parking Lot

Not every idea belongs on the roadmap.

Some ideas should simply be remembered.

Examples:

- 
- 
- 
- 
- 
- 
- 

Printable investigation boards
Case statistics
Investigation achievements
Reading progress integration
Interactive maps
Audio notes
Rich media attachments

These ideas remain intentionally unprioritized.

### 13.5 Feature Evaluation Framework

Before adding any new feature, ask:

Does it strengthen one of the Five Pillars?

Does it support the Prime Directive?

Does it respect the Single Source of Truth?

Does it preserve user ownership?

Does it ﬁt the Interaction Language?

Does it belong in LoreBound?

If the answer to any question is No, the proposal should be revised before implementation.

### 13.6 Revising the Roadmap

The roadmap is expected to evolve.

Ideas may be:

- 
- 
- 
- 
- 

Added
Removed
Reordered
Combined
Replaced

Every revision should preserve the identity of LoreBound established throughout this Codex.

🔒 Design Lock

The Future Roadmap exists to guide growth without encouraging feature creep.

Future versions should evolve intentionally rather than reactively.

Every signiﬁcant feature should strengthen the existing architecture before introducing new
concepts.

👨💻 Developer Notes

The roadmap is inspirational rather than contractual.

It provides direction while allowing the project to adapt as LoreBound matures and real users
reveal new needs.

Developers should avoid implementing roadmap items prematurely simply because they are
documented here.

Version 1 should remain the priority until it reaches the standards established by the Deﬁnition of
Done.

# Volume IV

## Chapter 14

Engineering Principles
"Code should faithfully express the ideas preserved within this Codex."

### 14.1 Purpose

This chapter establishes the engineering philosophy of LoreBound.

Technologies will evolve.

Frameworks will change.

Programming languages may eventually be replaced.

These principles should remain stable.

Every implementation decision should support the long-term health, maintainability, and identity
of LoreBound.

### 14.2 The Codex Is the Source of Truth

The LoreBound Codex governs the project.

When implementation conﬂicts with the Codex, the implementation should be reconsidered
before the Codex.

If the Codex itself requires revision, that revision should occur deliberately and be documented.

The software follows the Codex.

The Codex does not follow the software.

### 14.3 Readability Over Cleverness

Code should be written for humans ﬁrst.

Future contributors should understand the intent of a system without requiring extensive
explanation.

Simple, expressive code is preferred over highly optimized but difﬁcult-to-understand
implementations.

### 14.4 Modularity

Every major system should be modular.

Examples include:

- 
- 
- 
- 
- 
- 

Cases
Dossiers
Bonds
Boards
Timeline
Archive Search

Each system should evolve independently while integrating cleanly with the others.

No subsystem should become tightly coupled to another without clear architectural justiﬁcation.

### 14.5 Extend Before Replace

When adding functionality, developers should ﬁrst consider extending an existing system.

Creating an entirely new system should be the last option.

This preserves LoreBound's architectural consistency and reduces unnecessary complexity.

### 14.6 Performance Is a Feature

Responsiveness is part of the user experience.

Users should never feel that LoreBound slows down because their investigation has become
more detailed.

Performance should be considered from the beginning rather than treated as a later optimization.

### 14.7 Local-First

Version 1 prioritizes local ownership.

The application should function fully without requiring internet connectivity.

Future cloud functionality should enhance this model rather than replacing it.

Users always own their investigations.

### 14.8 Accessibility

Accessibility is a core design requirement.

It is not a future enhancement.

LoreBound should strive to support:

- 
- 
- 
- 
- 
- 

Keyboard navigation
Screen readers
High-contrast themes (future)
Scalable text
Color-independent visual cues
Reduced motion preferences

Every user should be able to investigate comfortably.

### 14.9 Progressive Enhancement

LoreBound should function correctly before adding advanced enhancements.

Examples:

A Board should remain usable before Living Bonds are animated.

Search should remain excellent before conversational search is introduced.

Visual polish should enhance functionality rather than compensate for missing functionality.

### 14.10 Preserve the Interaction Language

The Interaction Language established within this Codex deﬁnes how LoreBound communicates
with users.

Future interactions should reinforce these existing behaviors.

New interactions should only be introduced when they genuinely improve the investigation
experience.

Consistency builds familiarity.

### 14.11 Preserve the Five Pillars

Engineering decisions should strengthen the existing architectural pillars.

New systems should integrate into:

- 
- 
- 
- 
- 

Cases
Dossiers
Bonds
Boards
Investigative Lenses

Developers should avoid introducing competing organizational models.

### 14.12 Testing Philosophy

Testing should verify both correctness and experience.

Features should be evaluated for:

- 
- 
- 
- 
- 

Correct behavior
Performance
Accessibility
Consistency
Interaction quality

A technically correct feature that feels inconsistent with LoreBound should not be considered
complete.

### 14.13 Documentation Philosophy

Documentation evolves with the software.

Architectural changes require corresponding updates to:

- 
- 
- 

The LoreBound Codex
Acceptance Criteria
Version History

The Codex should always describe the current intended architecture.

### 14.14 Current Technical Stack (Version 1)

The following technologies represent the initial implementation plan.

Frontend

- 
- 
- 
- 

React
TypeScript
Vite
Tailwind CSS

Storage

- 

IndexedDB (local-ﬁrst)

Visualization

- 

React Flow (or an equivalent library if a superior solution is identiﬁed)

Desktop Packaging (Planned)

- 

Tauri
Version Control

- 
- 

Git
GitHub

These technologies may evolve without requiring changes to the engineering principles deﬁned
above.

🔒 Design Lock

Engineering decisions should always reinforce the philosophy, architecture, and identity
established throughout the Codex.

Speciﬁcally:

- 

The Codex governs the software.

- 
- 
- 
- 

Performance is a feature.
Readability takes precedence over cleverness.
Existing systems should be extended before new ones are created.
Users remain the owners of their investigations.

👨💻 Developer Notes

Developers should view this chapter as a long-term engineering charter rather than a technical
checklist.

Frameworks, libraries, and implementation details will naturally change over time.

These principles exist to ensure that LoreBound remains recognizable regardless of the
technologies used to build it.

## Chapter 15

Development Workflow
"A great product is not built in one leap. It is built through disciplined, repeatable
progress."

### 15.1 Purpose

This chapter deﬁnes the development process for LoreBound.

Its purpose is to ensure that every contribution, whether made by the Founder, future developers,
or AI-assisted tooling, follows a consistent workﬂow that preserves the quality, philosophy, and
long-term maintainability of the project.

Development should be predictable.

Progress should be measurable.

Every completed milestone should leave LoreBound in a releasable state.

### 15.2 Development Philosophy

LoreBound is developed incrementally.

Rather than attempting to build the entire application at once, development is divided into
focused milestones.

Each milestone introduces one complete system before progressing to the next.

Every milestone should conclude with:

- Working functionality
- 
- 
- 

Visual polish
Documentation updates
Passing acceptance criteria

No milestone should knowingly leave behind unﬁnished architecture.

### 15.3 Milestone Structure

Version 1 development is divided into the following milestones.

Milestone 0

Project Foundation

Purpose:

Establish the repository and development environment.

Deliverables:

- 
- 
- 
- 
- 
- 

Repository created
Initial project scaffold
Git initialized
The LoreBound Codex committed
Development environment veriﬁed
Basic application launches successfully

Milestone 1

Cases

Deliverables:

- 
- 
- 

Case Archive
Create Case
Edit Case

Delete Case
- 
- 
Case Opening Ritual
- Workspace transition

Milestone 2

Dossiers

Deliverables:

- 
- 
- 
- 
- 
- 

Universal Dossier framework
Character Dossiers
Location Dossiers
Event Dossiers
Organization Dossiers
Theory Dossiers

Milestone 3

The Bond System

Deliverables:

- 
- 
- 
- 
- 

Smart Bonds
Reciprocal Bonds
Bond Discovery
Bond Evidence
Bond Status

Milestone 4

Boards

Deliverables:

- Manual Board
- 
- 
- 
- 

Smart Board
Living Bonds
Smart Suggestions
Clusters

Milestone 5

Timeline

Deliverables:

- 
- 
- 
- 

Global Timeline
Focused Timeline
Timeline Ruler
Timeline ﬁlters

Milestone 6

Archive Search

Deliverables:

- 
- 
- 
- 

Universal Search
Search Context
Recent Searches
Board integration

Milestone 7

Polish & Release

Deliverables:

- 
- 
- 
- 
- 
- 

Performance optimization
Accessibility review
Bug ﬁxing
Final visual polish
Documentation review
Version 1 Release Candidate

### 15.4 Branching Strategy

Development should follow a simple branching model.

Main

Always represents the most stable version of LoreBound.

Development

Receives completed milestone work before merging into Main.

Feature Branches

Individual systems or improvements should be developed independently before merging into
Development.

Examples:

- 
- 
- 

feature/bond-system
feature/archive-search
feature/timeline

### 15.5 Commit Philosophy

Commits should represent meaningful progress.

Good examples:

- 
- 
- 
- 

Implement Character Dossiers
Add Smart Bond generation
Complete Timeline ﬁltering
Polish Board interactions

Avoid vague commits such as:

- 
- 
- 

Updates
Changes
Fixed stuff

The Git history should tell the story of LoreBound's development.

### 15.6 Documentation Workﬂow

The Codex evolves alongside the software.

If an architectural decision changes:

1. Update the Codex.
2. Review the implications.
3.
Implement the change.
4. Verify acceptance criteria.

Documentation should never lag behind the software.

### 15.7 AI-Assisted Development

AI tools are collaborators, not decision-makers.

They should:

- 
- 
- 
- 
- 

Implement approved architecture.
Generate boilerplate.
Explain code.
Suggest optimizations.
Identify defects.

They should not redeﬁne LoreBound's philosophy or architecture without explicit review.

The Codex remains the governing authority.

### 15.8 Milestone Completion

A milestone is complete only when:

- 
- 
- 
- 
- 

All planned functionality is implemented.
Acceptance Criteria are satisﬁed.
The Deﬁnition of Done has been met.
The application remains stable.
The Codex reﬂects the current implementation.

Only then should development move to the next milestone.

### 15.9 Continuous Improvement

Each completed milestone should leave LoreBound better than before.

Every iteration should improve:

Readability
- 
- Maintainability
- 
- 

Performance
User experience

No milestone should knowingly introduce technical debt that compromises future development.

🔒 Design Lock

Development proceeds through complete, sequential milestones.

Architecture should stabilize before expansion.

The Codex remains synchronized with the codebase.

Every milestone should leave LoreBound in a releasable state.

👨💻 Developer Notes

The workﬂow described in this chapter prioritizes long-term maintainability over rapid feature
delivery.

By completing one architectural pillar at a time, LoreBound minimizes rework and ensures that
future systems are built upon stable foundations.

## Chapter 16

Quality Standards
"Quality is not the ﬁnal step of development. It is the standard that guides every step."

### 16.1 Purpose

The purpose of this chapter is to deﬁne the standards by which every feature within LoreBound
is evaluated.

A feature is not considered complete simply because it functions correctly.

It must also satisfy the principles of usability, consistency, performance, accessibility,
maintainability, and immersion established throughout this Codex.

These standards apply equally to all future development.

### 16.2 Philosophy

Quality is holistic.

LoreBound should never sacriﬁce one aspect of quality to improve another without careful
consideration.

For example:

- 
- 
- 

Performance should not compromise readability.
Visual polish should not compromise usability.
New functionality should not compromise simplicity.
Every completed feature should feel like a natural part of LoreBound.

### 16.3 Acceptance Criteria

Every milestone and every feature should deﬁne explicit Acceptance Criteria before
implementation begins.

Acceptance Criteria describe observable outcomes rather than implementation details.

Example:

Character Dossier

A user can:

- 
- 
- 
- 
- 
- 
- 
- 

Create a Character.
Edit a Character.
Add Bonds.
Add optional Notes.
Add optional Evidence.
Navigate to connected Dossiers.
View the Character on the Board.
Explore the Character's Timeline.

If the criteria cannot be demonstrated, the feature is not complete.

### 16.4 Deﬁnition of Done

A feature is considered complete only when all of the following are true.

✅  Functionality

The feature performs correctly under expected use.

✅  Visual Polish

The feature feels like LoreBound.

✅  Interaction

The feature follows the Interaction Language.

✅  Performance

The feature remains responsive.

✅  Consistency

The feature follows the Codex.

✅  Documentation

The Codex has been updated if architectural changes occurred.

Final Rule

A feature is not ﬁnished because it works.

A feature is ﬁnished because it belongs.

### 16.5 User Experience Review

Every completed feature should be reviewed from the perspective of a ﬁrst-time user.

Questions include:

- 
- 
- 

Is its purpose immediately understandable?
Is unnecessary complexity avoided?
Does the interface encourage investigation?

- 

Does it feel immersive without becoming distracting?
User experience should be evaluated intentionally rather than assumed.

### 16.6 Accessibility Review

Every milestone should include an accessibility review.

Areas to evaluate include:

- 
- 
- 
- 
- 
- 

Keyboard navigation
Screen reader compatibility
Color contrast
Focus indicators
Scalable text
Reduced motion support

Accessibility should never become a post-release consideration.

### 16.7 Performance Review

Performance should be measured throughout development.

Review areas include:

- 
- 
- 
- 
- 
- 

Startup time
Search responsiveness
Board interaction
Timeline rendering
Large investigation handling
Animation smoothness

Performance regressions should be treated as defects.

### 16.8 Visual Review

Every feature should be evaluated for visual consistency.

Review includes:

- 
- 
- 

Typography
Spacing
Color usage

Iconography

- 
- Motion
- Workspace atmosphere

The interface should appear cohesive regardless of which feature is currently being used.

### 16.9 Regression Review

Every milestone should conﬁrm that existing functionality continues to operate correctly.

New features should never unintentionally degrade previously completed systems.

Stability is cumulative.

### 16.10 Codex Compliance

Every implementation should be reviewed against:

- 
- 
- 
- 
- 

Prime Directive
Five Pillars
Interaction Language
#### Design Locks

Engineering Principles

If implementation conﬂicts with the Codex, the conﬂict should be resolved before release.

### 16.11 Release Readiness

A release candidate should only be created after:

- 
- 
- 
- 
- 
- 

Acceptance Criteria are satisﬁed.
Deﬁnition of Done has been met.
Accessibility review is complete.
Performance review is complete.
Regression review is complete.
Codex Review is complete.

Only then should a version be considered ready for public use.

🔒 Design Lock

LoreBound measures quality by the complete user experience.

No feature should be considered complete until it satisﬁes every applicable quality standard
deﬁned within this chapter.

Quality is continuous, not optional.

👨💻 Developer Notes

Quality Standards exist to protect the identity of LoreBound as it grows.

While schedules and priorities may evolve, these standards should remain stable.

Developers should view this chapter as the project's quality charter and use it as the ﬁnal
checkpoint before considering any work complete.

## Chapter 17

Development Standards
"Every contribution should leave LoreBound more consistent, more understandable, and
more faithful to its purpose than before."

### 17.1 Purpose

This chapter establishes the standards that govern every contribution made to LoreBound.

Whether code is written by the Founder, another developer, or an AI-assisted development tool,
every contribution should reinforce the philosophy established throughout this Codex.

Consistency is more valuable than speed.

Quality is more valuable than quantity.

Identity is more valuable than novelty.

### 17.2 The Codex Governs Development

The LoreBound Codex is the governing authority of the project.

When uncertainty exists:

1. Consult the Codex.
2. Discuss the decision.
3. Update the Codex if necessary.
Implement the solution.
4.

Code should never redeﬁne the philosophy of LoreBound.

The Codex deﬁnes the software.

### 17.3 Preserve the Prime Directive

Every implementation should strengthen the Prime Directive.

Developers should continuously ask:

- 
- 
- 
- 
- 

Does this strengthen the investigation?
Does this reduce friction?
Does this preserve user ownership?
Does this support immersion?
Does this remain intuitive?

If the answer to any question is "No," the implementation should be reconsidered.

### 17.4 Respect Existing Systems

Before introducing a new system, developers should ﬁrst ask:

Can this be accomplished by extending an existing one?

LoreBound grows through reﬁnement.

Not through duplication.

### 17.5 Terminology Standards

LoreBound has its own language.

Always prefer established terminology.

Examples:

- 
- 
- 
- 
- 
- 
- 

Case
Dossier
Bond
Board
Investigative Lens
Knowledge Type
Evidence

Avoid introducing synonyms that create confusion.

Consistency of language reinforces consistency of thought.

### 17.6 User Experience First

When implementation choices conﬂict:

Prefer the option that creates the better user experience.

Even if it requires additional engineering effort.

LoreBound exists for investigators.

Not developers.

### 17.7 AI Contribution Standards

AI-assisted development is encouraged.

However:

AI should implement.

Not invent.

AI-generated architecture, workﬂows, or terminology should be evaluated against the Codex
before adoption.

Every architectural change requires deliberate human approval.

### 17.8 Design Lock Integrity

#### Design Locks exist to protect the identity of LoreBound.

They should never be bypassed for convenience.

If a Design Lock becomes inadequate:

Update the Codex ﬁrst.

Then update the software.

### 17.9 Canon Status

Every signiﬁcant proposal should receive a Canon Status before implementation.

Statuses include:

🟢  Canon

🟡  Under Investigation

🔵  Experimental

🔴  Rejected

This keeps project decisions transparent and prevents repeated discussions.

### 17.10 The Stewardship Principle

Every contributor becomes a temporary steward of LoreBound.

Stewardship carries responsibility.

Each contribution should improve at least one of the following:

Clarity
Consistency
Performance
Accessibility

- 
- 
- 
- 
- Maintainability
Immersion
- 

No contribution should knowingly diminish another.

### 17.11 Long-Term Thinking

LoreBound is intended to evolve over many years.

Short-term convenience should never compromise long-term maintainability.

Whenever possible, choose solutions that future contributors will understand, extend, and
appreciate.

### 17.12 Respect the User's Archive

The user's investigation is their own.

Every engineering decision should reinforce:

- 
- 
- 
- 

Ownership
Reliability
Privacy
Longevity

A user's archive should remain trustworthy above all else.

### 17.13 Continuous Learning

The Codex is a living document.

As LoreBound evolves:

- 
Lessons should be recorded.
- Mistakes should be documented.
- 

Better approaches should replace weaker ones.

The Codex should become wiser alongside the application.

🔒 Design Lock

Every contribution to LoreBound should reinforce the principles, terminology, architecture, and
philosophy established throughout this Codex.

Developers should extend the project thoughtfully rather than altering its identity.

The Codex remains the governing authority for every future version of LoreBound.

👨💻 Developer Notes

Development Standards exist to ensure that LoreBound remains recognizably LoreBound
regardless of who contributes to the project.

Future developers should view themselves not merely as programmers, but as stewards entrusted
with preserving the identity established by this First Edition of the Codex.

Appendix A

Design Decisions
"Every decision recorded here represents a moment where LoreBound became more
itself."

Purpose

This appendix preserves the reasoning behind signiﬁcant architectural, philosophical, and design
decisions made during the creation of LoreBound.

It exists to provide historical context for future contributors and to prevent important discussions
from being lost over time.

Future editions of the Codex should continue expanding this appendix rather than replacing it.

First Edition Decisions

DD-001

Project Name

Decision

The application shall be named LoreBound.

Reasoning

The name evokes the idea of being connected to lore, history, and ﬁctional worlds while
remaining memorable, concise, and brandable.

DD-002

Ofﬁcial Tagline

Decision

The ofﬁcial tagline is:

Investigate Every Story.

Reasoning

LoreBound is about investigation rather than consumption.

The tagline communicates purpose without limiting the application to books.

DD-003

Single Governing Document

Decision

All philosophy, architecture, engineering standards, and development processes shall exist within
The LoreBound Codex.

Separate governing documents shall not be maintained.

Reasoning

This preserves a Single Source of Truth and mirrors LoreBound's own architectural philosophy.

DD-004

The Five Pillars

Decision

LoreBound shall be organized around ﬁve permanent architectural pillars:

- 
- 

Cases
Dossiers

- 
- 
- 

Bonds
Boards
Investigative Lenses

Reasoning

Every major feature naturally strengthens one or more of these pillars.

DD-005

Knowledge Types

Decision

The term Knowledge Types replaces Record Types.

Reasoning

LoreBound should speak the language of investigation rather than databases.

DD-006

Bond System

Decision

Relationships shall be represented through the Bond System.

Reasoning

"Bond" reinforces the investigative theme and allows intelligent, bidirectional, evidence-aware
relationships.

DD-007

Interaction Language

Decision

LoreBound shall maintain named interactions.

Including:

- 
- 

Opening Ritual
Dossier Reveal

- 
- 

Living Bond
Timeline Ruler

Reasoning

Interaction consistency becomes part of LoreBound's identity.

DD-008

Workspace Philosophy

Decision

The application shall blend immersive physical objects with modern software usability.

Reasoning

Atmosphere should enhance usability without replacing it.

DD-009

Local-First Architecture

Decision

Version 1 shall prioritize local ownership over cloud services.

Reasoning

User ownership and reliability take precedence over synchronization.

DD-010

Canon Status

Decision

Future ideas shall receive one of four Canon Statuses:

- 
- 
- 
- 

Canon
Under Investigation
Experimental
Rejected

Reasoning

The Codex should investigate its own ideas just as LoreBound investigates ﬁctional worlds.

DD-011

Progressive Detail

Decision

Empty sections remain hidden until information exists.

Reasoning

Investigations should grow naturally rather than overwhelming users with empty interfaces.

DD-012

One Investigation. Many Ways to Explore It.

Decision

All Investigative Lenses shall reference the same underlying information.

Reasoning

Different perspectives should never duplicate knowledge.

Historical Notes

Future editions should never delete previous Design Decisions.

If a decision changes, a new Design Decision should be added explaining:

- What changed
- Why it changed
- Which previous decision it supersedes

The history of LoreBound is considered part of the project itself.

Appendix B

Glossary
"Shared language creates shared understanding."

This appendix deﬁnes the ofﬁcial terminology used throughout LoreBound.

Examples:

Case
: The highest level of organization representing a single ﬁctional universe or investigation.

Dossier
: The primary document containing knowledge about a speciﬁc subject.

Bond
: A structured relationship connecting two Dossiers.

Board
: A visual representation of Dossiers and Bonds.

Investigative Lens
: A different perspective through which the same investigation can be explored.

Knowledge Type
: A category of information, such as Character, Event, or Location.

Evidence
: Optional supporting information attached to a Dossier or Bond.

Workspace
: The immersive environment in which an investigation takes place.

This glossary should grow as LoreBound evolves.

Appendix C

Version History

Editi
on

Ver
sion

Date

Notes

First
Editi
on

1.0

TBD upon
publication

Founding edition of The LoreBound Codex. Established the
philosophy, architecture, engineering principles, and governance of
LoreBound.

Future editions should expand this table rather than replace it.

Appendix D

Credits

Founder

Jonathon Leach

Creator of LoreBound.

Founding Design Collaboration

The ﬁrst edition of The LoreBound Codex was developed through an iterative design
collaboration between Jonathon Leach and OpenAI's ChatGPT.

The collaboration focused on establishing a cohesive philosophy, architecture, interaction
language, and engineering governance before implementation began.

While the software itself will continue to evolve, the principles established within this ﬁrst
edition serve as the foundation upon which future versions of LoreBound are intended to build.

Ofﬁcial Closing

"Every investigation begins with curiosity.

Every discovery begins with a connection.

Every great archive begins with a single Case."
