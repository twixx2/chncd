import s from "./homeAbout.module.scss";

export const HomeAbout = () => (
    <section className={s.about}>
        <h2 className="section_title">
            what is this?
        </h2>
        <div className={s.content}>
            <p className={s.text}>
                chncd is a personal project, almost a mini-game platform, that was built only for fun.
                created on july 5th, 2025.
                here, you can place bets, open cases, exchange your items and more.
                all in-game currencies, stakes, gameplay elements and balances are entirely fictitious.
                chncd's creator condemns activities such as illegal gambling. love yall
            </p>
            <span className={s.made}>
                made with &hearts; by enbanana 
            </span>
        </div>
    </section>
)