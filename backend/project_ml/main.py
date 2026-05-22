from project_ml.ml.prediction import CompatibilityPredictor
from project_ml.persistence.model_repository import ModelRepository


def main() -> None:
    predictor = CompatibilityPredictor(ModelRepository().load_artifacts())
    sample = "Desenvolvi um dashboard em Power BI usando SQL, indicadores e analise de dados."
    result = predictor.predict(sample)
    print(result)


if __name__ == "__main__":
    main()
