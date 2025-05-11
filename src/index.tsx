import babySet from "@/assets/baby-set.jpg";
import s from "@/index.module.less";

const App = () => {
  return (
    <div className={s.app}>
      this is a test
      <img src={babySet} alt="baby set" />
    </div>
  );
};

export default App;
