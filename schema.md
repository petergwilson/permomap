--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4 (Ubuntu 17.4-1.pgdg24.04+2)
-- Dumped by pg_dump version 17.4 (Ubuntu 17.4-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: permolat_tracks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permolat_tracks (
    objectid bigint,
    shape__len double precision,
    trackname text,
    lastcheck double precision,
    custodian text,
    lastcut double precision,
    importance text,
    currentcon text,
    hikinggrad bigint,
    maintenanc bigint,
    marking text,
    docregion text,
    altitudech bigint,
    warnings text,
    conservati text,
    tracktype text,
    currentc_1 bigint,
    disttops bigint,
    lengthinbu bigint,
    datasource text,
    isroutegis text,
    complete text,
    globalid text,
    slopedist double precision,
    infonote text,
    nextcut text,
    xyz_distan double precision,
    zvalues_ca bigint,
    docregionb text,
    custodiang text,
    layer_name text,
    next_id bigint,
    prev_id bigint,
    status text,
    id integer NOT NULL,
    history text,
    geom public.geometry(Geometry,3857),
    original boolean DEFAULT false,
    rollback boolean DEFAULT false,
    multiple_status boolean DEFAULT false,
    status_overlay_links integer[],
    existing_track_info_field_links integer[]
)
WITH (parallel_workers='4');


ALTER TABLE public.permolat_tracks OWNER TO postgres;

--
-- Name: permolat_track_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permolat_track_versions (
    version_id bigint NOT NULL,
    parent_version_id bigint,
    comments text NOT NULL,
    added_by integer NOT NULL,
    added_timestamp timestamp with time zone NOT NULL,
    moderated_by integer,
    moderated_timestamp timestamp with time zone NOT NULL
)
INHERITS (public.permolat_tracks);


ALTER TABLE public.permolat_track_versions OWNER TO postgres;

--
-- Name: permolat_track_versions_version_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permolat_track_versions_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permolat_track_versions_version_id_seq OWNER TO postgres;

--
-- Name: permolat_track_versions_version_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permolat_track_versions_version_id_seq OWNED BY public.permolat_track_versions.version_id;


--
-- Name: permolat_tracks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permolat_tracks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permolat_tracks_id_seq OWNER TO postgres;

--
-- Name: permolat_tracks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permolat_tracks_id_seq OWNED BY public.permolat_tracks.id;


--
-- Name: permomap_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permomap_users (
    userid integer NOT NULL,
    username text NOT NULL,
    password character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    role character varying(20) NOT NULL,
    email text NOT NULL,
    active boolean NOT NULL,
    firstname text NOT NULL,
    lastname text NOT NULL,
    userinitial text,
    usercolor text
);


ALTER TABLE public.permomap_users OWNER TO postgres;

--
-- Name: permomap_users_userid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permomap_users_userid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.permomap_users_userid_seq OWNER TO postgres;

--
-- Name: permomap_users_userid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permomap_users_userid_seq OWNED BY public.permomap_users.userid;


--
-- Name: permolat_track_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions ALTER COLUMN id SET DEFAULT nextval('public.permolat_tracks_id_seq'::regclass);


--
-- Name: permolat_track_versions original; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions ALTER COLUMN original SET DEFAULT false;


--
-- Name: permolat_track_versions rollback; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions ALTER COLUMN rollback SET DEFAULT false;


--
-- Name: permolat_track_versions multiple_status; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions ALTER COLUMN multiple_status SET DEFAULT false;


--
-- Name: permolat_track_versions version_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions ALTER COLUMN version_id SET DEFAULT nextval('public.permolat_track_versions_version_id_seq'::regclass);


--
-- Name: permolat_tracks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_tracks ALTER COLUMN id SET DEFAULT nextval('public.permolat_tracks_id_seq'::regclass);


--
-- Name: permomap_users userid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permomap_users ALTER COLUMN userid SET DEFAULT nextval('public.permomap_users_userid_seq'::regclass);


--
-- Name: permolat_track_versions permolat_track_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions
    ADD CONSTRAINT permolat_track_versions_pkey PRIMARY KEY (version_id);


--
-- Name: permolat_tracks permolat_tracks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_tracks
    ADD CONSTRAINT permolat_tracks_pkey PRIMARY KEY (id);


--
-- Name: permomap_users permomap_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permomap_users
    ADD CONSTRAINT permomap_users_pkey PRIMARY KEY (userid);


--
-- Name: permolat_track_versions permolat_track_versions_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions
    ADD CONSTRAINT permolat_track_versions_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.permomap_users(userid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: permolat_track_versions permolat_track_versions_moderated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permolat_track_versions
    ADD CONSTRAINT permolat_track_versions_moderated_by_fkey FOREIGN KEY (moderated_by) REFERENCES public.permomap_users(userid) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

